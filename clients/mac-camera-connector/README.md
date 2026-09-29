# FloBama Mac Connector

Outbound agent that runs on the venue Mac (same LAN as cameras / Ecamm Live). It pairs to FloBama OS, reports camera sources, serves bandwidth-limited preview frames, and executes allowlisted PTZ commands.

**No public camera ports or router port forwarding.** The Mac polls HTTPS outbound to your FloBama OS host (Vercel-compatible).

## Requirements

- macOS with Node.js 20+ (LTS)
- FloBama OS deployed with migration `supabase/migrations/20260929000018_camera_connector.sql` applied
- Staff admin account to create a pairing code under **Cameras**
- For NDI discovery/preview: Local Network permission for the app/Node binary; first launch installs `grandi` NDI bindings via `npm install`
- For real PTZ later: camera model/protocol details (NDI PTZ capability bit and/or VISCA)

## Install (recommended: .dmg)

1. In FloBama OS → **Cameras**, download **FloBama Mac Camera (.dmg)**.
2. Drag **FloBama Mac Camera** into Applications and open it.
3. Create a pairing code (admin), then enter the FloBama OS address and code when prompted.
4. Leave the Terminal window open during shows.

Rebuild the disk image from this repo with:

```bash
npm run build:dmg:cameras
```

Output: `public/downloads/FloBama-Mac-Camera-1.3.0.dmg`

## Install (developer / CLI)

```bash
cd clients/mac-camera-connector
cp config.example.json mac-camera.config.json
# Edit apiBase to your FloBama OS origin, e.g. https://os.flobama.example
```

## Pair (one-time, CLI)

1. In FloBama OS → **Cameras** → **Create pairing code** (admin).
2. On the Mac:

```bash
node index.mjs --pair --code=YOURCODE
```

The device token is written to `mac-camera.config.json` (or Application Support when using the .dmg). It is never shown in the browser after pairing.

## Start / stop / update

**Foreground**

```bash
npm start
# or
node index.mjs
```

**Launch agent (auto start + restart)**

```bash
chmod +x macos/install.sh macos/uninstall.sh
./macos/install.sh          # start
launchctl bootout "gui/$(id -u)/com.flobama.mac-camera-connector"   # stop
./macos/install.sh          # update after git pull (reloads plist)
./macos/uninstall.sh        # remove launch agent
```

## Local disable remote control

Set in `mac-camera.config.json`:

```json
"remoteControlEnabled": false
```

The connector keeps heartbeating and can still supply previews; movement commands (except stop) are rejected. The Cameras UI shows “remote control disabled on Mac”.

## Diagnostics

```bash
node index.mjs --doctor
tail -f ~/Library/Logs/FloBamaMacConnector/connector.log
```

## Simulated cameras (default)

`useSimulatedCameras: true` exposes clearly labeled **Simulated** PTZ cameras plus a **Simulated Ecamm Program (preview only)** source. Use this for end-to-end auth, lease, stop-on-disconnect, and preview testing without hardware.

## Real NDI / VISCA cameras

**NDI discovery + preview (1.3.0+):** the connector finds LAN NDI sources, matches them to inventory by NDI name, auto-lists unmatched sources, and grabs low-bandwidth preview frames when receive works. Run `node index.mjs --doctor` to list what the Mac can see.

Because the .dmg opens **Terminal**, enable **Local Network for Terminal** in System Settings → Privacy & Security → Local Network (macOS will often prompt on first discovery).

**NDI / VISCA PTZ move commands** stay stubbed until you confirm:

- Camera make/model and whether NDI PTZ, VISCA/IP, or a vendor API is available
- macOS version on the venue Mac
- Whether Ecamm already consumes those NDI sources (program output must stay separate)

You can keep `useSimulatedCameras: true` alongside live NDI discovery; builtin sims only appear when inventory is empty.

## Sleep / network

- System Settings → Battery / Energy: prevent automatic sleep while producing
- Allow Local Network for Node if prompted (NDI discovery)
- Keep the Mac on wired Ethernet when possible
