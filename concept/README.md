# EN / CB launcher concept

The **Servers** tab below Library combines the two featured communities with compact server rows. EN zombie servers advertise **All maps** independently of the current map returned by the live list. Players can search and filter by community, game and region.

## Editing addresses

Edit `src/launcher-ui/assets/data/featured-servers.json`. This is the single bundled address list for both communities. EN entries were imported from https://erodednetworks.com/servers on 2026-09-30; the two Stank entries were confirmed against CB's live BO2 and BO3 feeds on the same date.

Each entry contains `community` (`en` or `cb`), `label` (fallback name), `game` (`t4`, `t5`, `t6` or `boiii`), `mode` (`mp` or `zm`), `host`, `port` and `enabled`. Set `enabled` to false to remove an entry. Regions come first from the live title (AU/NZ, EU, US), then live geographic metadata when no title prefix exists; saved location fields do not override the live title. The banner and filter options follow these current regions. All EN zombie rows advertise All maps. Never put passwords, keys or tokens in this public file.

Live data matches the saved game, mode and endpoint. Missing query results show unknown counts, rather than made-up statistics. Eroded and CB / Stank servers matching their community names in the live feeds are also discovered automatically. Update the JSON in a local test package under `cbservers/data/launcher-ui/assets/data/` and use Refresh to reload it. Ping measurements probe only the featured endpoints in one sweep, with immediate receive draining. Both community banners have their Discord invite buttons.

Rust is outside CB's supported game list. Ghosts Extinction is not included in this first concept because the launcher's Ghosts configuration currently exposes multiplayer without an Extinction mode.

## Local test build

Build the Release x64 solution using the repository's usual instructions, then run `scripts/package-en-cb.ps1`. A runnable package requires `cb-launcher.exe`, the UI under `cbservers/data/launcher-ui`, CEF runtime files under `cbservers/data/cef/Release`, Discord SDK runtime files under `cbservers/data/discord`, and CB's game manifests under `cbservers/manifest`. Omitting the manifests while disabling self-update causes installation-check errors at startup.

Start with `cb-launcher.exe -portable -noupdate -en-cb-concept`. The concept flag avoids registering Windows shortcuts and the default launcher URI handler. Portable settings stay beside this executable; the test package only copies existing game installation paths, not launcher accounts.

BOIII joins use CB's existing IPC transport with the selected server's mode. Plutonium uses CB's existing authenticated `plutonium://play/<game>` launch through Plutonium's own launcher. Never pass the saved login token directly to the bootstrapper: it needs a newly created game session and otherwise reports HTTP 401.

Plutonium r5354's native launcher discards additional URI connection parameters. The concept instead waits for the launched game's window and console output to settle, then submits one `connect host:port` command through Windows console input. It waits at least 12 seconds after the bootstrapper handoff and 3 seconds without console output changes, with a 90-second limit. It targets only that launched process, does not take keyboard focus, and detaches from the console after the handoff. It does not modify game files, access game memory or replace Plutonium authentication.

Buttons are **Launch & Join**. If the console handoff fails, the launcher reports that the game launched but auto-connect failed, with the manual command. Missing installations open setup. Password-protected and full servers have disabled launch buttons. Joining a running Plutonium game requires closing that game first. Debug builds with their own attached console do not use this handoff; elevated games may also deny console access.

Validation: Release x64 build, eight focused page/routing tests (`node --test scripts/test-featured-servers.cjs`), startup without missing-manifest dialogs, live EN/CB counts, and authenticated BO2 Zombies auto-connect to `103.152.197.155:4977`. In-game verification on 2026-09-30 confirmed automatic connection and loading Buried. BO1 and WaW use the same console handoff but still need their own in-game verification.
