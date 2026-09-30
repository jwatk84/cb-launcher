// No dependencies: tests the featured page's data boundaries and launch routing.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/launcher-ui/assets/js/app/featured-servers.js'), 'utf8');
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(setImmediate); };

async function page(options = {}) {
    const nodes = new Map();
    const calls = [];
    const get = id => {
        if (!nodes.has(id)) nodes.set(id, { innerHTML: '', textContent: '', value: '', disabled: false, handlers: {}, addEventListener(type, fn) { this.handlers[type] = fn; }, querySelectorAll() { return []; } });
        return nodes.get(id);
    };
    const en = { community: 'en', label: 'EN fallback', game: 't6', mode: 'zm', host: '203.0.113.1', port: 4976, region: 'OCE', allMaps: true };
    const cb = { community: 'cb', label: 'CB fallback', game: 'boiii', mode: 'mp', host: '203.0.113.2', port: 30120, region: 'NA' };
    const catalog = { servers: [en, cb, { ...en, host: 'bad;command' }, { ...en, enabled: false }] };
    const context = {
        document: { getElementById: id => id === 'servers-page' || nodes.has(id) || get('servers-page').innerHTML.includes(`id="${id}"`) ? get(id) : null }, console, setInterval: () => 1, clearInterval: () => {},
        fetch: async () => ({ ok: true, json: async () => catalog }),
        GameUtils: {
            escapeHtml: text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]),
            getGameConfigByUIId: id => ({ displayName: id === 't6' ? 'Black Ops 2' : 'Black Ops 3' }),
            getGameMapping: id => id === 'boiii' ? 'bo3' : id,
            launchGameWithMode: async (...args) => calls.push(['launch', ...args])
        },
        addRecentGame: id => calls.push(['recent', id]),
        showManageInstall: id => calls.push(['setup', id]),
        window: {
            copyTextToClipboard: async text => { calls.push(['copy', text]); return true; },
            showMessageBox: async () => options.cancel ? 1 : 0,
            executeCommand: async () => options.missingInstall ? null : 'C:/Games',
            ServersService: { getServers: async (game, live) => {
                assert.equal(live, true);
                if (options.queryFailure) throw new Error('network unavailable');
                return game === 't6' ? [{ id: '203.0.113.1:4976', name: options.name || '<img onerror=attack()>', region: 'OCE', mode: 'zm', map: 'Buried', players: 2, maxPlayers: 8 }] :
                    game === 'boiii' ? [{ id: '203.0.113.2:30120', name: "Stank's server", mode: 'mp', map: 'Fringe', players: 4, maxPlayers: 18 }] : [];
            }, pingServers: async addresses => { calls.push(['ping', ...addresses]); return { '203.0.113.1:4976': 23 }; } }
        }
    };
    vm.runInNewContext(source, context);
    context.window.FeaturedServers.setActive(true);
    await settle();
    return { get, calls, catalog, context, click: async index => { get('featured-list').handlers.click({ target: { closest: () => ({ dataset: { join: String(index) } }) } }); await settle(); } };
}

test('live metadata is escaped, all maps is separate, invalid/disabled entries are excluded, CB is deduplicated', async () => {
    const p = await page();
    const html = p.get('featured-list').innerHTML;
    assert.ok(html.includes('&lt;img onerror=attack()&gt;'));
    assert.ok(!html.includes('<img onerror=attack()>'));
    assert.ok(html.includes('All maps') && html.includes('Now: Buried'));
    assert.ok(!html.includes('bad;command'));
    assert.equal((html.match(/class="featured-row"/g) || []).length, 2);
});

test('AU filter includes Plutonium servers without a title prefix using their live region', async () => {
    const p = await page({ name: 'BO2 Plutonium Official' });
    p.get('featured-region').handlers.change({ target: { value: 'AU' } });
    assert.ok(p.get('featured-list').innerHTML.includes('203.0.113.1:4976'));
    assert.ok(p.get('featured-list').innerHTML.includes('>AU</div>'));
});

test('region and banner follow live title rather than saved location, and only featured endpoints are probed', async () => {
    const p = await page({ name: '^2[EU] ERODED Zombies' });
    assert.ok(p.get('featured-list').innerHTML.includes('>EU</div>'));
    assert.equal(p.get('featured-en-regions').textContent, 'EU · Zombies & Multiplayer');
    assert.ok(p.get('featured-region').innerHTML.includes('value="EU"'));
    assert.ok(!p.get('featured-region').innerHTML.includes('value="US"'));
    assert.deepEqual(p.calls.filter(c => c[0] === 'ping'), [['ping', '203.0.113.1:4976', '203.0.113.2:30120']]);
    assert.ok(p.get('featured-list').innerHTML.includes('23 ms'));
});

test('join routes BO2 Zombies and BO3 Multiplayer to their exact game, mode and endpoint', async () => {
    const p = await page();
    await p.click(0); await p.click(1);
    assert.deepEqual(p.calls.filter(c => c[0] === 'launch'), [
        ['launch', 't6', 't6', 'zm', '203.0.113.1:4976'],
        ['launch', 'bo3', 'boiii', 'mp', '203.0.113.2:30120']
    ]);
});

test('missing installation opens setup without launching', async () => {
    const p = await page({ missingInstall: true });
    await p.click(0);
    assert.deepEqual(p.calls.filter(c => c[0] !== 'ping'), [['setup', 't6']]);
});

test('Plutonium join launches directly without clipboard or confirmation fallback', async () => {
    const p = await page();
    await p.click(0);
    assert.ok(!p.calls.some(c => c[0] === 'copy'));
    assert.ok(p.calls.some(c => c[0] === 'launch'));
    assert.ok(!p.get('servers-page').innerHTML.includes('Launch & Copy'));
});

test('failed live queries retain addresses with unknown counts', async () => {
    const p = await page({ queryFailure: true });
    assert.ok(p.get('featured-notice').textContent.includes('counts are unknown'));
    assert.ok(p.get('featured-list').innerHTML.includes('203.0.113.1:4976'));
    assert.ok(!p.get('featured-list').innerHTML.includes('2 / 8'));
});

test('filters and refresh use the edited address list', async () => {
    const p = await page();
    p.get('featured-community-filter').handlers.change({ target: { value: 'cb' } });
    assert.ok(!p.get('featured-list').innerHTML.includes('203.0.113.1:4976'));
    assert.ok(p.get('featured-list').innerHTML.includes('203.0.113.2:30120'));
    p.catalog.servers[1].port = 30121;
    await p.get('featured-refresh').handlers.click();
    assert.ok(p.get('featured-list').innerHTML.includes('203.0.113.2:30121'));
});
