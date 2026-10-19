# Production Mac — Ecamm Live + Local Runner setup

FloBama OS never connects from the browser or Vercel to Ecamm’s private network address. Control flows:

**Staff Production UI → FloBama OS command API → paired Local Runner on the selected Mac → Ecamm Remote Control API (localhost/LAN).**

## Requirements

- macOS Mac running **Ecamm Live** with Remote Control (on by default)
- FloBama **Local Runner 1.3.0+** installed on that Mac
- FloBama staff account with Production menu access (admin/manager; viewers are read-only)

The Production Mac may be **distinct** from the LED wall Mac. Pair it as **Production Local Runner** under Screens → Display devices. OBS and Ecamm connection state stay independent.

## Install / update Local Runner

1. Download the Local Runner DMG from FloBama OS (Screens / downloads).
2. Install to `/Applications` and launch once so it can create Application Support paths.
3. In FloBama → **Screens → Display devices**, create a pairing code for **Production Local Runner** (or LED Local Runner if Ecamm and LED share one Mac).
4. Pair the runner (`--pair --code=…` or the installer’s pairing flow).
5. Confirm the device appears online.

## Approve FloBama OS in Ecamm

1. Open **Ecamm Live → Settings → Remote Control**.
2. Approve the client named **FloBama OS**.
3. In FloBama → **Production → Devices & Diagnostics**, select the correct Mac from Bonjour discovery (match hostname — never guess).
4. Connection states you should see:
   - **discovery** — browsing for `_ecammliveremote._tcp`
   - **awaiting_approval** — waiting for you to approve FloBama OS
   - **denied** — respect this; fix in Ecamm, then retry (runner does not keep prompting)
   - **connected** — approved and polling
   - **offline / reconnecting** — Ecamm closed or port moved; runner rediscovers the **same hostname** after restarts

Ecamm binds a **new port every launch**. The runner remembers hostname identity and rediscovers the port. It will not silently connect to a different Mac.

## Select the production device

Admins: Production → Devices → choose which paired runner is the venue’s production device. Managers use that selection for all control commands.

## Polling and safety

- `getInfo` is polled no faster than every **2 seconds**
- Structural lists refresh less often and after profile/scene changes
- Toggle / start-stop / meeting-end actions are **not** blindly replayed after timeouts
- Command statuses: queued → sent → acknowledged (runner accepted) → confirmed only when observed state matches

## LED wall / Performance Library

Existing LED playback, OBS control, camera tools, and Server Station behavior remain on the LED runner path. Production Ecamm audio is separate from LED performance volume.
