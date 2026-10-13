# Local Media Implementation Roadmap

**Status:** Concise implementation guide for Cursor after architecture approval.  
**Detail docs:** architecture, Mac runner, Android player, API contract, bandwidth, migration checklist.

---

## 1. Recommendation (executive)

Adopt **Option A**: FloBama Local Runner on the booth Mac serves `http://127.0.0.1:4173/wall` with a persistent media cache; Android Vertical Player uses Media3/ExoPlayer with the same manifest API. FloBama OS remains control plane; Supabase Storage becomes a **seed source**, not a streaming CDN for venue displays.

This is the only approach that reliably removes continuous HTTP 206 playback from Supabase while preserving OBS Browser Source workflows and existing Screens admin.

---

## 2. Recommended technology stack

| Layer | Choice |
|-------|--------|
| Control plane | Existing Next.js FloBama OS on Vercel |
| Data | Existing Supabase Postgres + Storage; additive tables |
| Mac runner | Node.js (extend `led-obs`), SQLite (`better-sqlite3` or `sql.js` if packaging requires), Node `http` |
| Mac UX | Menu bar JXA (camera pattern) + LaunchAgent |
| Mac distribute | DMG via existing Go dmg-writer scripts |
| Android | Kotlin, Media3, Room, WorkManager, OkHttp/Ktor |
| Android distribute | Signed APK in `public/downloads/` |
| Sync | Revision/ETag heartbeat + manifest; signed download grants |
| Auth | Device pairing tokens hashed at rest (camera pattern) |

---

## 3. Required changes to existing FloBama OS components

| Area | Change |
|------|--------|
| Uploads (`led-upload`, `browser-upload`, artist LED, specials, audience) | Compute/store sha256 + size |
| Queries for LED/vertical playback | Project into device manifests |
| Agent APIs | Add `/api/agent/v1/display-devices/*` |
| Screens UI | Device list, pairing codes, revoke, cache health |
| Download buttons | Local Runner DMG + Vertical APK alongside LED OBS / camera |
| Constants | Runner/APK versions, stale thresholds, SQL migration path constants |
| Cron / automation | Unchanged semantics; manifests reflect runtime |
| Public `/display/*` | **Keep** for rollback; not deleted |
| `led-obs` sync route | Keep through Mac cutover; then optional merge into heartbeat |

**Do not:** rebuild dashboard, replace playlist admin, remove OBS integration, remove Supabase.

---

## 4. Proposed new folders and files

```text
docs/
  local-media-architecture.md          # (this planning set)
  mac-local-runner-plan.md
  android-vertical-player-plan.md
  media-sync-api-contract.md
  bandwidth-optimization-plan.md
  display-migration-checklist.md
  local-media-implementation-roadmap.md

clients/local-runner/                  # successor to clients/led-obs
  index.mjs
  lib/{obs-sync,manifest,downloader,cache-db,http-server,menubar,status}.mjs
  lib/wall-player/                     # static player assets
  mac/                                 # .app shell
  macos/                               # LaunchAgent install/uninstall
  config.example.json
  package.json

clients/android-vertical-player/       # new Android project
  app/src/main/...

src/app/api/agent/v1/display-devices/
  pair/route.ts
  heartbeat/route.ts
  manifest/route.ts
  assets/[assetId]/download/route.ts

src/lib/display-devices/
  crypto.ts
  agent-auth.ts
  manifest.ts
  status.ts

src/actions/display-devices.ts
src/components/screens/display-devices-panel.tsx

supabase/migrations/YYYYMMDDHHMMSS_display_devices.sql
supabase/migrations/YYYYMMDDHHMMSS_media_content_hashes.sql

scripts/build-local-runner-dmg.mjs
scripts/local-runner-dmg/
public/downloads/FloBama-Local-Runner-x.y.z.dmg
public/downloads/FloBama-Vertical-Player-x.y.z.apk

tests/display-devices-manifest.test.ts
tests/media-hash.test.ts
```

Deprecate path (later): `clients/led-obs` → redirect docs/UI to Local Runner.

---

## 5. Database changes (necessary, additive)

1. **`display_devices`**, **`display_device_secrets`**, **`display_device_pairing_codes`**, **`display_device_status`** — device registry, auth, telemetry.
2. **`media_content_hashes`** (or columns on `screen_ads` / `led_wall_scenes`) — `sha256`, `size_bytes`, `media_type`.
3. Optional **`display_bandwidth_events`** — download bytes for budgets/alerts.
4. RLS + force RLS; staff policies; no anon on secrets.
5. Backfill job for hashes of existing Storage objects (off-peak).

No destructive migration of playlist tables.

---

## 6. Shared components between Mac and Android

| Concept | Shared? |
|---------|---------|
| Manifest JSON schema | Yes (API contract) |
| Asset id / sha256 / version | Yes |
| Atomic playlist activation rules | Yes |
| Pairing + Bearer auth | Yes |
| Heartbeat revision short-circuit | Yes |
| Download backoff / budget | Yes |
| Player UI | No (CEF wall vs ExoPlayer) |
| OBS WebSocket | Mac only |
| Localhost HTTP server | Mac only |
| Lock-task / boot OEM | Android only |

Consider a small shared JSON Schema / OpenAPI snippet in `docs/` or `packages/` later; not required for v1.

---

## 7. Dependencies and technical risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| OBS CEF localhost quirks | Medium | Shadow scene stage; fixed port |
| Player feature drift vs `LedDisplay` | Medium | Parity checklist; shared playlist index tests |
| Hash backfill egress spike | Medium | Budgeted off-peak backfill |
| Android OEM kills background | Medium | Foreground service; hardware verify |
| Device Owner assumed wrongly | Medium | Capability matrix; ordinary app first |
| Dual OBS cut writers during migration | High | Single sync path ownership |
| Accidental revert to hosted Browser Source | High | Monitoring for 206 storms; staff training |
| Org egress from non-FloBama projects | Medium | Measure and allocate budget |
| Packaging Node native modules (sqlite) | Medium | Validate DMG on clean Mac; fallback sql.js |

**Complexity estimate**

| Workstream | Complexity |
|------------|------------|
| Display-devices API + DB + staff UI | Medium |
| Mac Local Runner (cache + HTTP + player + packaging) | High |
| Android APK + offline + kiosk | High |
| Hash pipeline + backfill | Medium |
| Migration / monitoring | Medium |

Overall: **high** but incremental; venue risk managed by staged cutover.

---

## 8. Development phases (priority order)

### Phase 0 — Prep

- Confirm org egress breakdown; freeze baseline metrics.
- Hardware inventory for kiosks (Android version, storage, codecs).

### Phase 1 — Control plane foundation

- Migrations for devices + content hashes.
- Pair / heartbeat / manifest / download-grant routes.
- Upload path writes hashes; backfill script.
- Staff pairing UI (minimal).

### Phase 2 — Mac Local Runner MVP

- Cache + HTTP range server + health/status.
- Wall player with local media URLs.
- OBS sync preserved.
- LaunchAgent + menu bar + DMG.
- Stages 1–2 migration testing.

### Phase 3 — LED production cutover

- Stage 3 checklist; rollback drilled once.
- Bandwidth monitoring dashboards/alerts.

### Phase 4 — Android Vertical Player MVP

- Pairing, cache, ExoPlayer playlist, takeover, reboot.
- Stage 4 pilot on one kiosk.

### Phase 5 — Full venue local-first

- Second kiosk; Stage 5–6 monitoring.
- Tune sync intervals; optional deprecate public media hot path for these devices.

### Phase 6 — Hardening

- Signed-only Storage grants; consider non-public bucket.
- Lock-task if OEM allows.
- Playback analytics (optional).
- Remove or archive legacy `led-obs` package.

---

## 9. Test strategy

| Layer | Tests |
|-------|-------|
| Unit | Revision stability, manifest projection, playlist index parity with `ledPlaylistIndexAt`, hash verify, path traversal rejection |
| API | Pair consume-once, revoke → 401, unauthorized asset download → 403/404, 304 manifests |
| Mac integration | Range 206, resume download, never-delete-pinned, LaunchAgent restart |
| Android instrumentation | Offline play, takeover atomicity, reboot resume |
| OBS shadow | Side-by-side visual/timing checklist |
| Load / chaos | API 503 during download → no blank wall; disk-full refusal |
| Egress | Lab capture: play 1 hour local vs hosted byte counts |

Keep Vitest coverage style consistent with `tests/led-wall.test.ts` / `led-playlists.test.ts`.

---

## 10. Deployment strategy

1. Deploy FloBama API/DB changes **before** requiring new clients (backward compatible).
2. Ship Local Runner DMG via Screens; parallel install Stage 1–2.
3. Cut LED (Stage 3) with printed rollback card.
4. Ship APK; pilot one kiosk; then both.
5. Watch org cached egress for two weeks (Stage 6).
6. Only then consider making `screen-ads` private.

Vercel + Supabase migrations follow existing FloBama practices; no venue downtime required for API deploy if public displays remain.

---

## 11. Phased Cursor task list (implementation)

Use this checklist in order after planning approval:

1. [ ] Add `media_content_hashes` migration + upload instrumentation + backfill script.
2. [ ] Add `display_devices*` migrations + RLS + types.
3. [ ] Implement `display-devices` pair/heartbeat/manifest/download routes + Zod schemas.
4. [ ] Staff: pairing code + device list + revoke panel on Screens.
5. [ ] Scaffold `clients/local-runner` from `led-obs` + camera LaunchAgent/menubar.
6. [ ] Implement SQLite cache, downloader, localhost HTTP server.
7. [ ] Bundle local `/wall` player (LedDisplay parity subset).
8. [ ] Wire runner to manifest API; preserve OBS cuts.
9. [ ] DMG build script + constants + download UI.
10. [ ] Execute migration Stages 1–3 with venue.
11. [ ] Scaffold Android project; pairing + Room cache + ExoPlayer.
12. [ ] Takeover, boot, status reporting; APK publish path.
13. [ ] Migration Stages 4–6; bandwidth alerts.
14. [ ] Post-mortem + Phase 6 hardening backlog.

---

## 12. Security checklist (implementation gate)

- [ ] No service-role in Mac/Android artifacts
- [ ] Tokens hashed; pairing single-use
- [ ] Download grants device- and asset-scoped
- [ ] Localhost bind default on Mac HTTP
- [ ] Revoke tested
- [ ] Logs scrub secrets
- [ ] Update path uses staff-distributed signed binaries

---

## 13. What to reuse first

Highest leverage existing code:

1. `clients/mac-camera-connector` — pairing UX, menubar, LaunchAgent, DMG.
2. `clients/led-obs` — OBS WebSocket + sync loop.
3. `LedDisplay` / `VerticalPlayer` / playlist libs — behavioral specs.
4. Screens panels — extend, don’t replace.
5. Public display routes — rollback safety net.
