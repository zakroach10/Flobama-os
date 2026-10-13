# FloBama Local Runner — macOS Plan

**Status:** Planning document.  
**Depends on:** [local-media-architecture.md](./local-media-architecture.md), [media-sync-api-contract.md](./media-sync-api-contract.md)  
**Successor to:** `clients/led-obs/` (v1.0.2 DMG today)

---

## 1. Purpose

FloBama Local Runner is the booth Mac background application that:

1. Cuts OBS program scenes from FloBama OS (today’s `led-obs` job).
2. Downloads and persistently caches LED wall media.
3. Serves a local wall player and media over `http://127.0.0.1:4173`.
4. Reports health, cache, and sync status without requiring a Terminal window.

---

## 2. Recommendation: one process, not two

| Approach | Pros | Cons |
|----------|------|------|
| **Extend booth agent into Local Runner (adopt)** | One LaunchAgent, one token lifecycle, shared status UI, simpler ops | Larger codebase than current 102-line `index.mjs` |
| Separate cache daemon + keep `led-obs` | Smaller diffs initially | Two processes, two failure modes, duplicate heartbeat, port coordination |

**Decision:** Evolve `clients/led-obs` into `clients/local-runner` (or rename in place). Keep OBS sync in-process with the HTTP server and downloader.

Reuse packaging DNA from `clients/mac-camera-connector/` (menu bar JXA helper, LaunchAgent KeepAlive, Application Support config, DMG pipeline).

---

## 3. Component architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                 FloBama Local Runner (Node)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ OBS sync     │  │ Manifest     │  │ Media downloader  │  │
│  │ WebSocket    │  │ + heartbeat  │  │ resume + verify  │  │
│  └──────┬───────┘  └──────┬───────┘  └─────────┬─────────┘  │
│         │                 │                    │            │
│         ▼                 ▼                    ▼            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ SQLite cache index + /Users/Shared/FloBamaOS/media   │   │
│  └──────────────────────────┬───────────────────────────┘   │
│                             ▼                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Local HTTP :4173  /wall /media/:id /health /status   │   │
│  └──────────────────────────────────────────────────────┘   │
│  Menu bar (JXA) ← status.json     LaunchAgent KeepAlive     │
└─────────────────────────────────────────────────────────────┘
```

### 3.1 Module map (proposed)

| Module | Responsibility |
|--------|----------------|
| `index.mjs` | Boot, config load, supervise loops |
| `lib/obs-sync.mjs` | Port of current `led-obs` tick → `/api/agent/v1/led-wall/sync` or unified display sync |
| `lib/manifest.mjs` | Fetch/compare revision, enqueue downloads |
| `lib/downloader.mjs` | Concurrent-limited downloads, Range resume, backoff |
| `lib/cache-db.mjs` | SQLite asset index |
| `lib/http-server.mjs` | Localhost media + wall player |
| `lib/wall-player/` | Static/bundled player assets (LedDisplay-equivalent) |
| `lib/menubar.mjs` | Adapt from camera connector |
| `lib/status.mjs` | Write `status.json`, log helpers |
| `macos/install.sh` + plist | LaunchAgent |
| `mac/*.sh` + `Info.plist` | `.app` shell for DMG |

### 3.2 Relevant existing repository files

| File | Reuse how |
|------|-----------|
| `clients/led-obs/index.mjs` | OBS connect, sync POST, scene cut loop |
| `clients/led-obs/config.example.json` | Extend with cache dir, port, device token |
| `clients/led-obs/mac/*` | Base for `.app` launcher |
| `scripts/build-led-obs-dmg.mjs` + `scripts/led-obs-dmg/` | Fork to Local Runner DMG |
| `clients/mac-camera-connector/lib/menubar.mjs` | Menu-bar pattern |
| `clients/mac-camera-connector/macos/*` | LaunchAgent KeepAlive pattern |
| `src/app/api/agent/v1/led-wall/sync/route.ts` | Keep for OBS cuts; optionally fold into display-devices later |
| `src/components/screens/led-display.tsx` | Behavioral spec for local `/wall` player |
| `src/lib/screens/led-playlists.ts` | Shared playlist index math must match |
| `src/components/screens/obs-client-download.tsx` | Point staff UI at new DMG |
| `src/lib/constants.ts` | `LED_OBS_*` version constants → runner versions |

---

## 4. Persistent media cache

### 4.1 Directory layout

```text
/Users/Shared/FloBamaOS/
  media/
    blobs/                 # final files named by sha256
    tmp/                   # *.partial downloads
    cache.sqlite
  runner/                  # optional shared runtime state
```

Config (per user / Application Support) holds: `apiBase`, device token (or migrated booth token), OBS host/port/password, `bindHost` (`127.0.0.1`), `bindPort` (`4173`), `cacheRoot`, `maxCacheBytes`, `bandwidthBudgetBytesPerDay` (optional).

### 4.2 Download behavior

- Formats: MP4, WebM, MOV (if playable in OBS CEF), PNG, JPEG, WebP as assigned.
- Key by `(assetId, version)` and content `sha256`.
- Skip download when local ready hash matches manifest.
- Resume interrupted downloads with HTTP Range when Storage/grant supports it.
- Exponential backoff: e.g. 1s, 2s, 4s … cap 5 min; jitter; circuit-break after N failures per asset.
- Verify sha256 + size before activating.
- Never delete `pinned` or currently playing assets.
- Capacity: configurable default (e.g. 20–50 GB); LRU unreferenced.
- Report progress via status API and menu bar (“Downloading 2/7 · 41%”).

### 4.3 Integrity

- Prefer streaming hash while writing `tmp/`.
- On mismatch: delete partial, mark corrupt, retry.
- Periodic scrub of ready assets (idle hours) optional.

---

## 5. Local HTTP media server

### 5.1 Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/wall` | Local LED wall player (HTML shell) |
| GET | `/wall/*` | Player static assets (JS/CSS) |
| GET | `/media/{assetId}` | Cached media bytes (Range supported) |
| HEAD | `/media/{assetId}` | Size / type probes |
| GET | `/health` | Liveness `{ ok: true, uptime }` |
| GET | `/status` | Cache, sync, OBS, disk, revision (local diagnostics) |

Default bind: **`127.0.0.1:4173`**. Do not bind `0.0.0.0` unless explicitly enabled for lab debugging.

### 5.2 Streaming requirements

- Support `Range` → **206 Partial Content** with correct `Content-Range`, `Accept-Ranges: bytes`.
- Stream from disk (`fs.createReadStream`); never buffer entire videos in RAM.
- MIME from DB `media_type` / extension map.
- Seeking and looping stay local (eliminates Supabase 206 storms).
- Missing / not-ready asset → **404** or **409** with JSON error; player keeps last-known-good surface.
- Reject `..`, absolute paths, encoded traversal; allow only known `assetId` keys from SQLite.
- Optional `Origin` allowlist unnecessary for pure localhost OBS; still avoid reflecting arbitrary paths.

### 5.3 Implementation note

Node `http`/`node:fs` is sufficient. Prefer no heavy framework. If using a small helper, keep dependency surface tiny for offline booth reliability.

---

## 6. OBS Browser Source compatibility

### 6.1 Cutover target

| Setting | Value |
|---------|-------|
| Browser Source URL | `http://127.0.0.1:4173/wall` |
| Width × height | Existing LED wall pixel size |
| Scene | Still the configured `media_obs_scene_name` |

OBS **obs** kind scenes (cameras, band feeds) remain native OBS scenes; agent still cuts by name. No change to that path.

### 6.2 Local player requirements

Must preserve:

- Playlist timing aligned with `ledPlaylistIndexAt` / `activated_at`
- Media and OBS playlist slots (black on display while agent cuts OBS)
- Trivia wall + audience wall overlays (poll FloBama JSON APIs)
- Soft update on revision without unnecessary full reload when possible
- Staff “refresh wall” signal: prefer soft remount; hard reload of local `/wall` only when required

**Bundling strategy:** Ship a purpose-built player bundle inside the runner (ported from `LedDisplay` behavior) that resolves media through `/media/{id}`. Do not iframe `https://flobama…/display/led` for media playback (Option B failure modes).

Trivia/audience may continue to call public FloBama APIs for **state**; cache large media those overlays need when practical.

### 6.3 Operator UX

- Upload new ads in Screens as today → runner downloads in background → playlist activates when ready → OBS Browser Source unchanged.
- No manual media path edits in OBS after go-live.

### 6.4 Parallel / shadow testing

Keep a second OBS scene “FloBama Local Shadow” with Browser Source on `:4173/wall` while production still uses hosted `/display/led`. See migration checklist.

---

## 7. Remote synchronization

### 7.1 Dual loops

1. **OBS control loop** (low latency): existing sync semantics — report OBS state, receive `desiredObsScene`, cut if needed. Target interval **2s** initially (today 1s); evaluate 1s only if live ops require it. Prefer server returning `revision` so unchanged ticks are cheap.
2. **Media manifest loop:** when `revision` changes, fetch full manifest; enqueue downloads; atomically publish playlist when complete.

### 7.2 What is synchronized

Active scene, active playlist, order, media versions/hashes, schedules (as expressed by FloBama runtime), additions/removals, takeovers (if applied on LED path), emergency overrides, reload signals.

### 7.3 Auth migration

Phase 1 may accept existing LED booth Bearer token for OBS sync while adding display-device pairing for manifest downloads. Phase 2 unifies on display-device credentials with venue + capability `led_wall`.

---

## 8. Application lifecycle and packaging

### 8.1 Recommended product shape

**Menu-bar app + LaunchAgent KeepAlive** (camera connector model), not “open Terminal and leave it running.”

| Concern | Approach |
|---------|----------|
| Install | DMG → drag `FloBama Local Runner.app` to Applications |
| First run | Prompt apiBase + pair code or paste booth token; write config under Application Support |
| Autostart | LaunchAgent `RunAtLoad` + `KeepAlive` |
| No Terminal | `.app` launcher runs embedded/bundled Node like current DMGs |
| Status | Menu bar: Connected / OBS / Cache % / Sync age |
| Logs | `~/Library/Logs/FloBamaLocalRunner/` |
| Update | Versioned DMG from Screens download button; replace `.app`; LaunchAgent restarts |
| Uninstall | `macos/uninstall.sh` removes LaunchAgent; optional cache purge flag |

### 8.2 Why not launchd-only without menu bar

launchd alone works, but booth staff need connected/disconnected visibility without SSH. Camera connector already proved menu bar + status.json on this fleet.

### 8.3 Node runtime

Continue current pattern: DMG stages app that ensures a local Node runtime under Application Support (or bundle Node). Prefer matching camera/LED OBS operational familiarity over introducing Swift-only rewrite in v1.

---

## 9. Diagnostics and remote visibility

Local `/status` and FloBama status reports should include:

- Runner version, uptime
- OBS connected, program scene
- Manifest revision, last sync OK/fail
- Cache bytes used / limit, asset ready counts
- Active download queue + errors
- Disk free space warning threshold
- Last playback asset id (best-effort from player heartbeat)

Staff Screens panel shows online/offline using `last_seen_at` stale window (similar to `LED_AGENT_STALE_MS`, optionally lengthened to 30s if heartbeat is 5s).

---

## 10. Development task breakdown (implementation phase)

1. Scaffold `clients/local-runner` from `led-obs` + camera menubar/LaunchAgent pieces.
2. Implement SQLite cache + blob store + downloader with verify.
3. Implement localhost HTTP range server + `/health` `/status`.
4. Port wall player consuming local `/media/{id}` + FloBama control JSON.
5. Wire manifest API client (after server contract lands).
6. Preserve OBS sync; add revision short-circuit.
7. DMG + constants + Screens download UI.
8. Shadow-scene QA checklist.
9. Production cutover + rollback doc for booth Mac.

---

## 11. Risks specific to Mac runner

| Risk | Mitigation |
|------|------------|
| OBS CEF quirks with localhost | Shadow scene validation; fixed port; HTTP not HTTPS for local |
| Port 4173 conflict | Configurable port; write chosen URL to status + staff UI |
| Shared folder permissions | Create with `chmod`/`acls` during install; document |
| Dual token confusion during migration | Clear UI; migrate booth token → device token in one flow |
| Player feature drift vs hosted `LedDisplay` | Shared fixture tests for playlist index; checklist for trivia/audience |
| Cache fills disk | Hard limit + alerts + refuse downloads before eviction of pins |
