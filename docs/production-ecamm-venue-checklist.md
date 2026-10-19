# Venue Mac acceptance checklist — Production / Ecamm

Automated tests use mocked protocol fixtures only. Complete these on the venue Mac before trusting live control.

## Install & pairing

- [ ] Local Runner **1.3.0+** installed on the Production Mac
- [ ] Paired as Production Local Runner (or shared LED runner if intentional)
- [ ] Heartbeat shows online in Screens → Display devices
- [ ] Admin selected this device as the Production device

## Discovery & approval

- [ ] Bonjour lists the intended Mac hostname
- [ ] Selecting hostname connects; selecting a different Mac is refused when identity is saved
- [ ] First contact shows **awaiting_approval** until Ecamm → Remote Control approves **FloBama OS**
- [ ] Denied state stops prompting until manual retry after fixing Ecamm
- [ ] Quit/relaunch Ecamm: runner rediscovers **new port**, same hostname
- [ ] LED OBS status remains independent if OBS is offline

## Status & polling

- [ ] Status strip shows connection, last success, scene, button labels
- [ ] Broadcast/recording inference shows confidence/source (button label) — not a fake “LIVE” badge
- [ ] getInfo cadence ≥ 2s under load (no tab-driven stampede)

## Scenes & sources

- [ ] Scene grid lists real scenes; favorites persist
- [ ] setScene confirms reported scene before overlay list updates
- [ ] Next/Prev update overlays for the new scene only
- [ ] Default camera label is **not** claimed as live camera
- [ ] PIP control labeled as toggle with no status
- [ ] Profile switch reloads dependent lists
- [ ] Scene/video/overlay image snapshots (if used) show timestamps — not continuous preview

## Audio

- [ ] Buses present on the Mac show volume; unavailable buses show unavailable (not 0)
- [ ] Global mute toggles
- [ ] Per-bus mute hidden/disabled until admin enables after testing
- [ ] Sound play/stop/pause/volume work; no fabricated meters
- [ ] LED performance volume unaffected

## Graphics & comments

- [ ] Overlay list matches **current scene only**
- [ ] Overlay toggle updates Visible for live scene
- [ ] Comment set/show/hide
- [ ] Links to FloBama web overlays work; internal notes never exposed

## Recordings & markers

- [ ] Create session with event + artist IDs stored explicitly
- [ ] Midnight-spanning / multi-set session behaves
- [ ] Recording started in Ecamm without event → unassigned session associable later
- [ ] Mark Highlight: OS marker saved even if Ecamm rejects
- [ ] Ecamm marker dialog behavior noted (marker ≠ clip)
- [ ] Shortcuts finished path accepted only under recordings root
- [ ] Duplicate finished notifications are idempotent
- [ ] Catalog scan associates completed file without uploading media blobs to OS storage

## Zoom

- [ ] Controls capability-gated when not in meeting
- [ ] Leave/end requires confirmation; ending for everyone is explicit
- [ ] Mute all / record toggles show acknowledged, not confirmed, until getInfo reflects state

## Commands & failure

- [ ] Expired commands rejected after Mac reconnect
- [ ] Toggle timeout reports uncertain — no blind replay
- [ ] Unsupported/gated endpoint does not take down the integration
- [ ] Viewer cannot enqueue controls; server role has no Production menu by default

## Regression

- [ ] LED wall playback / performance queue still works
- [ ] Camera connector PTZ unchanged
- [ ] Server Station unchanged
