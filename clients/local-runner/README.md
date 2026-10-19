# FloBama Local Runner

Booth Mac agent that:

1. Pairs with FloBama OS as a `led_runner` display device
2. Downloads LED playlist media into `/Users/Shared/FloBamaOS/media`
3. Serves `http://127.0.0.1:4173/wall` for the OBS Browser Source
4. Cuts OBS scenes from FloBama heartbeats
5. Inventories Dropbox **Ecamm session folders** for the Performance Library and plays queued shows in performance mode

## Install (venue Mac)

1. Build or download `FloBama-Local-Runner-1.2.0.dmg`
2. Drag **FloBama Local Runner** into Applications and open it
3. In FloBama → Screens → Display devices, create an **LED Local Runner** pairing code
4. Enter API base + code + OBS WebSocket settings
5. Point OBS media Browser Source to `http://127.0.0.1:4173/wall`
6. Optional autostart: `macos/install.sh`
7. Apply these SQL migrations on the hosted Supabase project:
   - `supabase/migrations/20261018000054_performance_library.sql`
   - `supabase/migrations/20261019000055_performance_session_assets.sql`
8. Configure the Recordings folder (see below)

## Performance Library — Recordings folder

**Dropbox-relative path** (not the Mac absolute path):

`/A- View 360 Brands/3- Customers/F/Flobama/Recordings`

Session folders live directly under that root:

`Ecamm Recording on YYYY-MM-DD at HH.mm.ss/`

Each session contains a primary `Ecamm Recording on ….mp4` plus Camera A/B (and numbered variants). The runner catalogs **one session per folder**, attaches cameras as assets, parses the timestamp from the folder name in **America/Chicago**, and ignores `.inProgress.nosync`. Do not point the root at other similarly named Recordings trees or at `/Ecamm Live Recordings` (legacy loose-file layout — configure separately if needed).

Discover the local synced path for the Dropbox-relative root:

```bash
cd clients/local-runner
node index.mjs --discover-recordings
```

Select and scan:

```bash
node index.mjs --set-recordings-root="/Users/…/Dropbox/A- View 360 Brands/3- Customers/F/Flobama/Recordings"
node index.mjs --inventory-recordings --export=~/Desktop/performance-inventory.json
# or CSV:
node index.mjs --inventory-recordings --export=~/Desktop/performance-inventory.csv
```

Online-only Dropbox placeholders are **not** auto-hydrated. Staff should right-click → **Make available offline**, then use **Prepare for Playback** in Screens. LED playback re-checks that the primary file is fully local.

Local APIs (wall Mac only, not public):

- `GET http://127.0.0.1:4173/api/recordings/settings`
- `POST http://127.0.0.1:4173/api/recordings/scan`
- `GET http://127.0.0.1:4173/api/recordings/export.json`
- `GET http://127.0.0.1:4173/recordings/:id/media` (Range / HEAD)

Original Dropbox files are never renamed, moved, deleted, or placed in the ad media cache eviction pool.

## Dev

```bash
cd clients/local-runner
cp config.example.json local-runner.config.json
# set apiBase, then:
node index.mjs --pair --code=ABCD1234
node index.mjs local-runner.config.json
```

Build DMG from repo root (macOS + Go):

```bash
npm run build:dmg:local-runner
```
