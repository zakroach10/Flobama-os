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

`supabase/migrations/20260929000018_camera_connector.sql`

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

See `clients/mac-camera-connector/README.md` for install/pair/start/stop/uninstall, launch agent, logs, NDI notes, and sleep settings.

Summary:

1. Apply SQL migration.
2. Deploy FloBama OS with service role env.
3. On Mac: Node 20+, copy config, set `apiBase`, pair with admin code, `npm start` or `macos/install.sh`.
4. Open **Cameras** as admin/manager; select a simulated camera; preview + PTZ.

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
- Simulated PTZ cameras + simulated program-output (preview only)
- Snapshot preview via private storage + media route
- Hold-to-move PTZ pad, zoom, speed, presets (when advertised), Stop
- Leases, watchdog, expired-command rejection
- Staff permission gates
- Mac launch agent scripts and diagnostics

### Not hardware-verified (blocked on venue details)

- Official NDI SDK discovery and NDI PTZ capability detection
- VISCA/IP or manufacturer API adapters for specific camera models
- Live Ecamm program NDI/HDMI capture as a real preview source
- WebRTC preview with TURN for remote WANs
- Preset save on real hardware
- Focus control on real hardware

Provide when ready: camera make/model list, which sources appear in Ecamm/NDI tools, macOS version, and whether each unit supports NDI PTZ, VISCA, or another documented API.
