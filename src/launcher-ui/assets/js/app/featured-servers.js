(function () {
    'use strict';
    const esc = value => GameUtils.escapeHtml(String(value == null ? '' : value));
    let catalog = null;
    let rows = [];
    let active = false;
    let loading = false;
    let timer = null;
    let community = 'all';
    let game = 'all';
    let region = 'all';
    let search = '';
    let lastRefresh = '';
    let failures = [];
    let joining = false;
    const host = () => document.getElementById('servers-page');
    const gameName = id => (GameUtils.getGameConfigByUIId(id) || {}).displayName || id;
    const provider = id => id === 'boiii' ? 'BOIII' : 'Plutonium';
    const titleRegion = name => {
        const title = String(name || '').replace(/\^[0-9]/g, '');
        if (/\b(AU(?:\/NZ)?|AUS|AUSTRALIA|OCE)\b/i.test(title)) return 'AU';
        if (/\b(EU|EUROPE)\b/i.test(title)) return 'EU';
        if (/\b(US|USA|UNITED STATES)\b/i.test(title)) return 'US';
        if (/\b(ASIA|SEA)\b/i.test(title)) return 'ASIA';
        return '';
    };
    const liveRegion = (name, live) => titleRegion(name) || (live && (live.region === 'OCE' ? 'AU' : live.region)) || '';

    function shell() {
        host().innerHTML = `
            <div class="page-header"><div class="page-title">Servers <span class="featured-build-tag">EN / CB CONCEPT</span></div>
            <div class="page-subtitle">Find your next game. Join BOIII directly or launch Plutonium with a copied connect command.</div></div>
            <div class="featured-communities">
                <div class="featured-community featured-en"><button class="featured-community-content" data-community="en"><span class="featured-kicker">FEATURED COMMUNITY</span><strong>ERODED<br><em>NETWORKS</em></strong><span id="featured-en-regions">Zombies & Multiplayer</span><small>All zombie maps · Official & Modded</small></button><button class="featured-discord" id="featured-en-discord">Join Discord ↗</button></div>
                <div class="featured-community featured-cb"><button class="featured-community-content" data-community="cb"><span class="featured-kicker">FEATURED COMMUNITY</span><strong>CB / STANK<br><em>SERVERS</em></strong><span>Community multiplayer servers</span><small>Black Ops 2 & Black Ops 3</small></button><button class="featured-discord" id="featured-cb-discord">Join Discord ↗</button></div>
            </div>
            <div class="featured-list-heading"><h2>Featured servers</h2><span id="featured-updated" role="status"></span></div>
            <div class="featured-toolbar">
                <input id="featured-search" aria-label="Search servers" placeholder="Search servers, hosts or maps…" />
                <select id="featured-community-filter" aria-label="Community"><option value="all">All communities</option><option value="en">Eroded Networks</option><option value="cb">CB / Stank</option></select>
                <select id="featured-game" aria-label="Game"><option value="all">All games</option></select>
                <select id="featured-region" aria-label="Region"><option value="all">All regions</option></select>
                <button class="mods-btn" id="featured-refresh">Refresh</button>
            </div>
            <div id="featured-notice" role="status"></div><div id="featured-list"></div>
            <p class="featured-footnote">EN zombies: all maps available; “Now” shows the current map. Hostnames and counts come from live server queries. CB / Stank servers are discovered from the live lists.</p>`;
        document.getElementById('featured-search').addEventListener('input', event => { search = event.target.value; renderRows(); });
        for (const [id, set] of [['featured-community-filter', value => community = value], ['featured-game', value => game = value], ['featured-region', value => region = value]]) {
            document.getElementById(id).addEventListener('change', event => { set(event.target.value); renderRows(); });
        }
        host().querySelectorAll('[data-community]').forEach(button => button.addEventListener('click', () => {
            community = community === button.dataset.community ? 'all' : button.dataset.community;
            document.getElementById('featured-community-filter').value = community;
            renderRows();
        }));
        document.getElementById('featured-refresh').addEventListener('click', refresh);
        document.getElementById('featured-en-discord').addEventListener('click', () => {
            window.executeCommand('open-url', { url: 'https://discord.gg/HWgB6G3KFd' });
        });
        document.getElementById('featured-cb-discord').addEventListener('click', () => {
            window.executeCommand('open-url', { url: 'https://discord.com/invite/WyJQCwCCGW' });
        });
        document.getElementById('featured-list').addEventListener('click', event => {
            const button = event.target.closest('[data-join]');
            if (button) join(rows[Number(button.dataset.join)]);
        });
    }

    function renderRows() {
        const list = document.getElementById('featured-list');
        if (!list) return;
        const visible = rows.map((row, index) => ({ row, index })).filter(({ row }) =>
            (community === 'all' || row.community === community) && (game === 'all' || row.game === game) &&
            (region === 'all' || row.region === region) && `${row.name} ${row.label} ${row.host} ${row.live && row.live.map || ''} ${gameName(row.game)}`.toLowerCase().includes(search.toLowerCase()));
        list.innerHTML = visible.length ? visible.map(({ row, index }) => {
            const live = row.live;
            const maps = row.allMaps ? 'All maps' : row.mode === 'zm' ? 'Zombies' : 'Multiplayer';
            const full = live && Number(live.maxPlayers) > 0 && Number(live.players) >= Number(live.maxPlayers);
            const locked = live && live.locked;
            return `<div class="featured-row">
                <img class="featured-game-art" src="./assets/img/games/${esc(row.game)}/capsule.jpg" alt="" />
                <span class="featured-badge ${row.community === 'en' ? 'is-en' : ''}">${row.community === 'en' ? 'EN' : 'CB'}</span>
                <button class="featured-server-name" data-join="${index}" ${joining || locked || full ? 'disabled' : ''} title="Launch ${esc(gameName(row.game))} and join ${esc(row.name)}"><strong>${esc(row.name)}</strong><small>${esc(row.host)}:${row.port}</small></button>
                <div class="featured-game-label"><strong>${esc(gameName(row.game))}</strong><small>${esc(provider(row.game))} · ${row.mode === 'zm' ? 'Zombies' : 'Multiplayer'}</small></div>
                <div class="featured-map"><strong>${maps}</strong><small>Now: ${esc(live && live.map || 'Unknown')}</small></div>
                <div class="featured-region-label">${esc(row.region === 'OCE' ? 'AU' : row.region || '—')}</div>
                <div class="featured-players"><strong>${live ? `${Number(live.players) || 0} / ${Number(live.maxPlayers) || 0}` : '—'}</strong><small>${live ? (typeof live.ping === 'number' ? `${live.ping} ms` : 'Listed live') : 'Not listed'}</small></div>
                <button class="featured-join" data-join="${index}" ${joining || locked || full ? 'disabled' : ''}>${locked ? 'Password required' : full ? 'Server full' : row.game === 'boiii' ? 'Launch & Join' : 'Launch & Copy'}</button>
            </div>`;
        }).join('') : `<div class="mods-empty">${loading ? 'Loading featured servers…' : 'No servers match these filters.'}</div>`;
        document.getElementById('featured-updated').textContent = loading ? 'Refreshing…' : `${visible.length} servers · ${lastRefresh}`;
        document.getElementById('featured-refresh').disabled = loading;
    }

    async function refresh() {
        if (loading) return;
        loading = true;
        renderRows();
        try {
            {
                const response = await fetch('./assets/data/featured-servers.json', { cache: 'no-store' });
                if (!response.ok) throw new Error('Cannot load featured server address list');
                catalog = await response.json();
                if (!Array.isArray(catalog.servers)) throw new Error('Invalid server address list');
            }
            const configured = catalog.servers.filter(row => row.enabled !== false && valid(row));
            const games = [...new Set([...configured.map(row => row.game), 't6', 'boiii'])];
            const results = await Promise.allSettled(games.map(id => window.ServersService.getServers(id, true, false)));
            failures = [];
            const liveRows = [];
            results.forEach((result, index) => {
                if (result.status === 'fulfilled') result.value.forEach(server => liveRows.push({ ...server, game: games[index] }));
                else failures.push(gameName(games[index]));
            });
            rows = configured.map(row => {
                const live = liveRows.find(server => server.game === row.game && server.id === `${row.host}:${row.port}` && (!server.mode || server.mode === row.mode));
                const name = live && live.name || row.label;
                return { ...row, live, name, region: liveRegion(name, live), allMaps: row.community === 'en' && row.mode === 'zm' };
            });
            const cbMatcher = /\bstank\b|\[cb\]|cbservers|cb servers/i;
            liveRows.filter(server => cbMatcher.test(server.name) || /\beroded\b/i.test(server.name)).forEach(live => {
                if (catalog.servers.some(row => row.enabled === false && row.game === live.game && `${row.host}:${row.port}` === live.id)) return;
                if (rows.some(row => row.game === live.game && `${row.host}:${row.port}` === live.id)) return;
                const separator = live.id.lastIndexOf(':');
                const owner = /\beroded\b/i.test(live.name) ? 'en' : 'cb';
                const row = { community: owner, game: live.game, label: live.name, name: live.name, mode: live.mode || 'mp', host: live.id.slice(0, separator), port: Number(live.id.slice(separator + 1)), region: liveRegion(live.name, live), allMaps: owner === 'en' && live.mode === 'zm', live };
                if (valid(row)) rows.push(row);
            });
            // Probe this page's endpoints once, rather than four entire game lists concurrently.
            try {
                const pings = await window.ServersService.pingServers([...new Set(rows.filter(row => row.live).map(row => `${row.host}:${row.port}`))]);
                rows.forEach(row => { if (row.live) row.live.ping = typeof pings[`${row.host}:${row.port}`] === 'number' ? Math.round(pings[`${row.host}:${row.port}`]) : null; });
            } catch (_) { rows.forEach(row => { if (row.live) row.live.ping = null; }); }
            const regions = [...new Set(rows.map(row => row.region).filter(Boolean))].sort();
            const regionSelect = document.getElementById('featured-region');
            regionSelect.innerHTML = '<option value="all">All regions</option>' + regions.map(id => `<option value="${esc(id)}">${esc(id)}</option>`).join('');
            if (!regions.includes(region)) region = 'all';
            regionSelect.value = region;
            const enRegions = [...new Set(rows.filter(row => row.community === 'en' && row.live).map(row => row.region).filter(Boolean))].sort();
            document.getElementById('featured-en-regions').textContent = (enRegions.length ? enRegions.join(' & ') + ' · ' : '') + 'Zombies & Multiplayer';
            const select = document.getElementById('featured-game');
            select.innerHTML = '<option value="all">All games</option>' + games.map(id => `<option value="${esc(id)}">${esc(gameName(id))}</option>`).join('');
            select.value = game;
            lastRefresh = `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            document.getElementById('featured-notice').textContent = failures.length ? `Live data unavailable for ${failures.join(', ')}. Saved addresses remain available; counts are unknown.` : !rows.some(row => row.community === 'cb') ? 'No CB / Stank servers found in the live lists. Brad can add fixed addresses to the featured list.' : '';
        } catch (error) {
            document.getElementById('featured-notice').textContent = error.message;
            catalog = null;
        } finally { loading = false; renderRows(); }
    }

    function valid(row) {
        return ['en', 'cb'].includes(row.community) && ['t4', 't5', 't6', 'boiii'].includes(row.game) &&
            ['mp', 'zm'].includes(row.mode) && typeof row.host === 'string' && /^[a-zA-Z0-9.-]+$/.test(row.host) &&
            Number.isInteger(row.port) && row.port > 0 && row.port <= 65535;
    }

    async function join(row) {
        if (!row || joining) return;
        joining = true;
        renderRows();
        try {
            const backend = GameUtils.getGameMapping(row.game);
            const install = await window.executeCommand('get-game-property', { game: backend, suffix: 'install' });
            if (!install) { showManageInstall(row.game); return; }
            if (row.game !== 'boiii') {
                const command = `connect ${row.host}:${row.port}`;
                const copied = await window.copyTextToClipboard(command);
                const choice = await window.showMessageBox(gameName(row.game) + ' · Plutonium',
                    `Plutonium launches this game through its own launcher. This version does not pass a server address to the game.\n\n${copied ? 'Copied: ' : 'Use: '}${command}\n\nOnce the game opens, open its console with ~ and paste this command to join.`, ['Launch game', 'Cancel']);
                if (choice !== 0) return;
            }
            addRecentGame(row.game);
            await GameUtils.launchGameWithMode(backend, row.game, row.mode, `${row.host}:${row.port}`);
        } catch (error) {
            document.getElementById('featured-notice').textContent = `Could not join ${gameName(row.game)}: ${error.message || error}`;
        } finally { joining = false; renderRows(); }
    }

    window.FeaturedServers = {
        setActive(value) {
            active = value;
            clearInterval(timer);
            if (!active) return;
            if (!document.getElementById('featured-list')) shell();
            refresh();
            timer = setInterval(() => { if (active) refresh(); }, 30000);
        }
    };
})();
