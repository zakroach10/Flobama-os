# FloBama Local Runner

Booth Mac agent that:

1. Pairs with FloBama OS as a `led_runner` display device
2. Downloads LED playlist media into `/Users/Shared/FloBamaOS/media`
3. Serves `http://127.0.0.1:4173/wall` for the OBS Browser Source
4. Cuts OBS scenes from FloBama heartbeats

## Install (venue Mac)

1. Build or download `FloBama-Local-Runner-1.0.0.dmg`
2. Drag **FloBama Local Runner** into Applications and open it
3. In FloBama → Screens → Display devices, create an **LED Local Runner** pairing code
4. Enter API base + code + OBS WebSocket settings
5. Point OBS media Browser Source to `http://127.0.0.1:4173/wall`
6. Optional autostart: `macos/install.sh`

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
