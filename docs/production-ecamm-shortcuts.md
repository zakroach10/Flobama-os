# Ecamm Shortcuts → FloBama Local Runner

Use macOS Shortcuts (or Automator) with Ecamm’s recording/broadcast triggers so FloBama can associate finished files with production sessions and the Performance Library.

## Local callback

Local Runner listens on **localhost only**:

`POST http://127.0.0.1:4173/api/ecamm/shortcuts`

JSON body:

```json
{
  "type": "recording_finished",
  "path": "/path/to/Dropbox/.../Ecamm Recording on 2026-10-18 at 21.05.00/Ecamm Recording on 2026-10-18 at 21.05.00.mp4",
  "at": "2026-10-19T02:15:00.000Z",
  "idempotencyKey": "optional-stable-key",
  "secret": "optional-if-configured"
}
```

Allowed `type` values:

- `recording_started`
- `recording_finished`
- `broadcast_started`
- `broadcast_finished`

## Path validation

Finished-file paths must resolve under the configured recordings root (Dropbox-relative default):

`/A- View 360 Brands/3- Customers/F/Flobama/Recordings`

Do **not** hardcode a macOS username. Configure the local synced folder via Performance Library / `--set-recordings-root`.

The handler rejects paths outside those roots. For `recording_finished`, it waits until the file size is stable before indexing.

Duplicate notifications with the same idempotency key (or same finished path) are ignored.

## Suggested Shortcut

1. Trigger: Ecamm “Recording Finished” (or equivalent) providing the file path.
2. Action: **Get contents of URL** / curl to `http://127.0.0.1:4173/api/ecamm/shortcuts` with JSON above.
3. Optional: set `ecammShortcutsSecret` in the Local Runner config and send the same value as `secret` or header `x-flobama-shortcuts-secret`.

## After notification

1. Runner validates path and waits for write settle.
2. Runner queues a recordings scan / catalog sync (existing Performance Library path).
3. Runner may POST the event to FloBama (`/api/agent/v1/display-devices/production/recording-event`) when online.
4. Staff associate the recording with a production session / event if it started without a selected event (unassigned session).

## What this does **not** do

- Does not upload full recordings or ISO camera files into the FloBama database
- Does not edit clips or run song detection via the Ecamm control API
- Markers (`setMarker`) are not rendered clips — only chapter markers in Ecamm’s timeline semantics
