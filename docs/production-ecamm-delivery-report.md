# Production / Ecamm delivery report

## Reference pins

| Item | Value |
| --- | --- |
| Official API | Ecamm Live Remote API **v4.4** (`docs/ecamm-live-remote-api-v4.4.md`) |
| Companion module | `bitfocus/companion-module-ecamm-live@4.0.1` |
| Commit SHA | `4f8d7e09e0940e576d6b637723065ee34df1f84a` |
| FloBama Local Runner | **1.3.0** |
| Verified endpoints | **70** (see [ecamm-endpoint-coverage.md](./ecamm-endpoint-coverage.md)) |

## Implemented in this repository

- Production staff menu + dark control-room UI (Overview, Scenes, Audio, Graphics, Recordings, Zoom, Devices & Diagnostics)
- Local Runner modular Ecamm adapter (discovery, HTTP transport, parsers, state, controller, Shortcuts handler)
- Authenticated command path: UI → OS → paired runner → Ecamm (no browser/Vercel → Ecamm)
- Additive migration `20261019000058_production_ecamm.sql` (sessions, markers, commands, audit, recording events, `production_runner` device kind)
- Permissions: admin configure, manager control, viewer read-only, server denied by default
- Event detail → Production entry with `eventId`
- Status strip with precise command labels; broadcast state inferred from button labels with confidence/source
- Per-bus mute gated behind `allow_per_bus_mute`
- Docs: Mac setup, Shortcuts, venue checklist, endpoint coverage

## Verified with automated tests (mocked)

- Query encoding (`%20` spaces)
- Parsers for info/scenes/overlays/sounds/permission
- Hostname identity matching / no silent Mac switch
- Allowlisted endpoints; reject arbitrary commands
- Per-bus mute gate
- Command TTL expiry + persistent dedupe
- Shortcuts auth, path validation, duplicate finished events
- Role authorization matrix
- Existing LED/performance regression suites

## Hardware-unverified (requires venue Mac)

All mutating Ecamm actions (`set*`), live approval UX, port rediscovery against a real Ecamm instance, marker dialog artifacts, Zoom meeting controls, Shortcuts triggers from Ecamm, and real recording file association. Use [production-ecamm-venue-checklist.md](./production-ecamm-venue-checklist.md).

## Unsupported / gated

- Per-bus mute: undocumented; enabled only after admin toggle post venue testing
- Continuous live browser preview: not provided by Remote API alone (snapshots via image endpoints only)
- Live camera identity, PIP status, current profile, playing-sound identity: not reported by API
- Clip export / song detection: not claimed; would be a separate local job if added later

## Packaging

Bump Local Runner to **1.3.0** (package.json, Info.plist, DMG script, paths VERSION). DMG build now copies `lib/` recursively (includes `lib/ecamm/`).
