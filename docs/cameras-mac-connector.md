# FloBama remote cameras — setup, costs, and verification status

## Architecture

| Layer | Role |
| --- | --- |
| FloBama OS (Vercel / Next.js) | Auth, pairing codes, leases, command queue, snapshot media route, Cameras UI |
| Supabase | Postgres + private `camera-previews` storage; service role used by agent APIs |
| FloBama Mac Connector | Outbound HTTPS poll; discovery; PTZ; snapshot encode; local disable switch |
| Optional later | Managed TURN (WebRTC) + dedicated media worker (not on Vercel serverless) |

The Mac initiates all connections. Cameras stay on the venue LAN. Preview bytes are not served from ordinary staff API CRUD routes; they use `/api/media/v1/cameras/preview/[sessionId]` with a staff session cookie.

## Apply database migration

Run in the Supabase SQL editor (or CLI):

- `supabase/migrations/20260929000018_camera_connector.sql`
- `supabase/migrations/20260929000019_camera_inventory.sql` (if not already applied)
- `supabase/migrations/20260929000020_camera_preview_base64.sql` (inline preview frames)

Requires `SUPABASE_SERVICE_ROLE_KEY` on the web app for pairing consumption, agent sync, and private snapshot storage.

## External services and costs

| Service | Required now? | Notes / cost |
| --- | --- | --- |
| Vercel (or current host) | Yes | Existing FloBama OS hosting; no persistent WebSocket server assumed |
| Supabase | Yes | Existing project; small storage for JPEG/PNG previews (private bucket) |
| TURN (e.g. Twilio STUN/TURN, Cloudflare Calls, Metered.ca) | **Not required for MVP** | Needed only when enabling true WebRTC preview for remote operators. Roughly $0–$50+/mo depending on relay minutes |
| Dedicated media/SFU worker | **Not required for MVP** | Needed for low-latency WebRTC at scale; Vercel serverless cannot host a persistent media relay |

**MVP preview path:** authorized snapshot polling (~1 fps class) suitable for framing and PTZ. WebRTC signaling columns exist; Mac returns a clear “TURN/media worker required” failure until provisioned.

## Mac setup (exact)

### Recommended (.dmg)

1. Apply SQL migration and deploy FloBama OS with service role env.
2. On the venue Mac: open **Cameras** in FloBama OS → **Download Mac Camera (.dmg)**.
3. Drag **FloBama Mac Camera** into Applications, open it (right-click → Open if Gatekeeper blocks).
4. Admin creates a pairing code; enter FloBama OS address + code in the first-run prompts.
5. Leave Terminal open; open **Cameras** as admin/manager; select a simulated camera; preview + PTZ.

Rebuild: `npm run build:dmg:cameras` → `public/downloads/FloBama-Mac-Camera-1.2.0.dmg`

Allow **Local Network** when macOS prompts — required for NDI discovery. First launch runs `npm install` for the `grandi` NDI bindings.

### CLI / launch agent

See `clients/mac-camera-connector/README.md` for Node CLI install, `--pair`, launch agent, logs, NDI notes, and sleep settings.

## Roles

| Role | Cameras |
| --- | --- |
| Admin | Pair/revoke Mac, operate PTZ, preview |
| Manager | Operate PTZ, preview |
| Viewer | Status only (no PTZ / no preview start) |

## Safety behaviors (implemented)

- Short command TTL; expired commands never delivered or replayed after reconnect
- One control lease per camera
- Stop on pointer up/cancel, window blur, lease release
- Mac movement watchdog (~1.2s) stops motion if polls drop
- Local `remoteControlEnabled` kill switch on Mac
- Allowlisted command kinds/payloads only
- Pairing codes single-use + short-lived; device token hashed at rest
- Audit log for pairing, revoke, commands, preview (no secrets)

## Implemented vs hardware-verified

### Implemented (software / sim)

- Pairing + revocable device credential
- Heartbeat / online status in Cameras UI
- Staff camera inventory (create NDI / VISCA / simulated / program-output cameras)
- Clear “you are controlling” banner + burned-in preview labels
- Mac menu-bar status (`Cam ●` / offline / controlling)
- Simulated PTZ cameras + simulated program-output (preview only)
- Snapshot preview via private storage + inline base64 fallback + media route
- Mac-side NDI source discovery (`grandi`) merged with staff inventory
- Auto-surface discovered NDI sources not yet in inventory (preview-first)
- Hold-to-move PTZ pad, zoom, speed, presets (when advertised), Stop
- Leases, watchdog, expired-command rejection
- Staff permission gates
- Mac launch agent scripts and diagnostics
- Downloadable `.dmg` (`npm run build:dmg:cameras`) — reinstall **1.2.0** for discovery

### Not hardware-verified (blocked on venue details)

- NDI PTZ capability detection / move commands on real NDI cameras
- VISCA/IP or manufacturer API adapters for specific camera models
- Live Ecamm program NDI receive quality under show load
- WebRTC preview with TURN for remote WANs
- Preset save on real hardware
- Focus control on real hardware

Provide when ready: camera make/model list, which sources appear in Ecamm/NDI tools, macOS version, and whether each unit supports NDI PTZ, VISCA, or another documented API.
