# Media Sync API Contract

**Status:** Proposed contract for implementation. Illustrative schemas; field names may be adjusted during build but semantics should hold.  
**Consumers:** FloBama Local Runner (macOS), FloBama Vertical Player (Android).  
**Source of truth:** FloBama OS + Postgres (existing playlist/runtime tables).

---

## 1. Design goals

1. Authorize **devices**, not naked asset URLs.
2. Download media **once** per content hash per device.
3. Avoid full playlist payloads every second when nothing changed.
4. Preserve low-latency scene switching for LED/OBS.
5. Never require service-role keys on devices.
6. Reuse existing ads/playlists/LED scenes/takeovers — manifest is a **projection**, not a parallel CMS.

---

## 2. Namespace

```text
/api/agent/v1/display-devices/
```

All routes: `dynamic = "force-dynamic"`, HTTPS only in production, JSON request/response.

**Auth:** `Authorization: Bearer <device_token>` except pair.

Service-role Supabase access happens **only** inside Next.js route handlers after token verification (same pattern as `authenticateCameraDevice` / LED booth sync).

---

## 3. Device model

### 3.1 Proposed tables (additive)

Names illustrative:

| Table | Purpose |
|-------|---------|
| `display_devices` | id, venue_id, label, kind (`led_runner` \| `vertical_kiosk`), capabilities JSON, app_version, revoked_at, last_seen_at, created_at |
| `display_device_secrets` | device_id, token_hash, created_at, revoked_at |
| `display_device_pairing_codes` | venue_id, code_hash, expires_at, consumed_at, intended_kind |
| `display_device_status` | device_id PK, obs_connected, program_scene, cache_bytes, cache_limit_bytes, manifest_revision, current_asset_id, download_progress JSON, last_error, disk_free_bytes, reported_at |
| `media_content_hashes` | asset_ref (table+id), storage_path, sha256, size_bytes, media_type, computed_at |

Existing tables remain authoritative for content: `screen_ads`, `screen_playlists`, `screen_takeovers`, `led_wall_scenes`, `led_wall_playlists`, `led_wall_runtime`, etc.

### 3.2 Token format

- Prefix e.g. `fbdisp_` + high-entropy base64url (mirror `fbcam_`).
- Store **SHA-256 hash** only.
- Timing-safe compare on auth.
- Show raw token **once** at pair time.

### 3.3 RLS

- Force RLS on new tables.
- No anon access to secrets/status base tables.
- Staff admin/manager policies for read/revoke/pair-code create.
- Agent routes use service role after Bearer auth.

---

## 4. Endpoints

### 4.1 `POST /api/agent/v1/display-devices/pair`

Unauthenticated. Exchanges pairing code for device credentials.

**Request**

```json
{
  "code": "AB12CD34",
  "label": "LED Booth Mac",
  "kind": "led_runner",
  "hostname": "booth-mac.local",
  "appVersion": "1.0.0",
  "capabilities": {
    "obs": true,
    "localHttp": true,
    "orientation": "landscape"
  }
}
```

**Response `200`**

```json
{
  "deviceId": "uuid",
  "venueId": "uuid",
  "token": "fbdisp_…",
  "apiBase": "https://…",
  "kind": "led_runner"
}
```

**Errors:** `400` invalid body, `401` bad/expired code, `503` misconfigured/migrations missing.

**Server behavior:** Consume code once; optionally revoke prior device of same kind for venue (policy: LED runner one-per-venue like camera; vertical allow N).

---

### 4.2 `POST /api/agent/v1/display-devices/heartbeat`

Authenticated. Cheap tick for liveness, commands, and revision advertisement.

**Request**

```json
{
  "appVersion": "1.0.0",
  "manifestRevision": "2026-10-12-v4",
  "currentAssetId": "video-001",
  "playbackState": "playing",
  "obs": {
    "connected": true,
    "programScene": "LED Media",
    "scenes": ["LED Media", "Camera 1"]
  },
  "cache": {
    "bytesUsed": 2400000000,
    "bytesLimit": 40000000000,
    "assetsReady": 12,
    "assetsPending": 1
  },
  "downloads": {
    "active": [{ "assetId": "video-009", "bytesReceived": 1000, "bytesTotal": 5000 }]
  },
  "diskFreeBytes": 80000000000,
  "lastError": null
}
```

**Response `200`**

```json
{
  "ok": true,
  "serverTime": "2026-10-13T02:00:00.000Z",
  "manifestRevision": "2026-10-12-v5",
  "manifestChanged": true,
  "commands": {
    "safeRefresh": false,
    "desiredObsScene": "LED Media"
  },
  "bandwidth": {
    "budgetBytesRemainingToday": 5000000000
  }
}
```

**Notes**

- If `manifestRevision` matches server, `manifestChanged: false` — client skips manifest GET.
- `desiredObsScene` may live here **or** remain on legacy `/api/agent/v1/led-wall/sync` during migration; avoid double-cutting OBS (single writer).
- Upsert `display_device_status` + `last_seen_at`.

**Suggested client interval:** Mac 2–5s (OBS latency); Android 15–30s.

---

### 4.3 `GET /api/agent/v1/display-devices/manifest`

Authenticated. Full authorized playlist projection for this device.

**Headers:** `If-None-Match: "<revision>"` optional → `304 Not Modified`.

**Response `200`**

```json
{
  "revision": "2026-10-12-v5",
  "etag": "2026-10-12-v5",
  "deviceId": "uuid",
  "venueId": "uuid",
  "generatedAt": "2026-10-13T02:00:01.000Z",
  "mode": "playlist",
  "playlistId": "main-led",
  "startedAt": "2026-10-13T01:00:00.000Z",
  "fallbackPlaylistId": "default-ad-roll",
  "takeover": null,
  "reloadNonce": 42,
  "items": [
    {
      "slotId": "item-1",
      "kind": "media",
      "assetId": "video-001",
      "durationSeconds": 30,
      "transition": "cut",
      "obsSceneName": null
    },
    {
      "slotId": "item-2",
      "kind": "obs",
      "assetId": null,
      "durationSeconds": 15,
      "transition": "cut",
      "obsSceneName": "Camera 1"
    }
  ],
  "assets": [
    {
      "id": "video-001",
      "version": 4,
      "sha256": "…",
      "sizeBytes": 55000000,
      "durationSeconds": 30,
      "mediaType": "video/mp4",
      "downloadPath": "/api/agent/v1/display-devices/assets/video-001/download"
    }
  ],
  "overlays": {
    "triviaEnabled": true,
    "audienceEnabled": true
  }
}
```

**Vertical devices** omit OBS slots; include takeover object when active:

```json
"takeover": {
  "adId": "…",
  "assetId": "…",
  "endsAt": "2026-10-13T03:00:00.000Z"
}
```

**Authorization:** Only assets belonging to the device’s venue and currently referenced (or soft-retained for graceful rollback) appear. Knowing an `assetId` from elsewhere must not grant download.

**Dynamic week_events:** Represent as asset with `mediaType: "application/vnd.flobama.week-events+json"` or a cached still image asset produced server-side; client must not be told to stream arbitrary Storage paths without a grant.

---

### 4.4 `POST /api/agent/v1/display-devices/assets/{assetId}/download`

Authenticated. Issues a **short-lived** download grant.

**Why POST:** Audits device identity, checks assignment, rate limits, records metrics.

**Response `200`**

```json
{
  "assetId": "video-001",
  "sha256": "…",
  "sizeBytes": 55000000,
  "mediaType": "video/mp4",
  "expiresAt": "2026-10-13T02:15:00.000Z",
  "url": "https://…/storage/v1/object/sign/screen-ads/…?token=…"
}
```

**Rules**

- Verify device not revoked.
- Verify asset in current (or previous retained) manifest for device.
- Prefer Supabase **signed** URL (TTL 5–15 minutes) even if bucket remains public during migration.
- Optionally proxy via FloBama if signed URLs are not yet available — still authorize per device.
- On unknown/unauthorized asset → `404` (do not confirm existence across venues) or `403`.
- Record bytes granted / completed for bandwidth metrics when possible.

**Client:** Download with resume; verify sha256; do not persist the signed URL as long-term auth.

---

### 4.5 `POST /api/agent/v1/display-devices/status` (optional distinct from heartbeat)

If heartbeat payloads grow too large, split detailed cache inventory here (30–60s). Otherwise heartbeat is enough for v1.

---

### 4.6 Staff actions (server actions / existing Screens UI)

Not agent routes, but required:

- `createDisplayPairingCodeAction({ kind })`
- `revokeDisplayDeviceAction(deviceId)`
- `listDisplayDevicesQuery(venueId)`
- Map safe refresh → bump command flag or reuse `screen_display_signals.reload_nonce` projected into manifest/heartbeat.

---

## 5. Legacy coexistence

| Legacy | Migration stance |
|--------|------------------|
| `POST /api/agent/v1/led-wall/sync` | Keep until Local Runner heartbeat owns OBS cuts; then deprecate |
| `GET /api/public/v1/screens/led` | Keep for hosted `/display/led` rollback and overlays |
| `GET /api/public/v1/screens/vertical` | Keep for browser kiosks during pilot |
| LED booth token tables | Accept during Phase 1; migrate to `display_devices` |

Local wall player may call public trivia/audience wall JSON endpoints initially (read-only, small). Long term, fold overlay flags into manifest.

---

## 6. Revision algorithm

Revision string must change when any of these change:

- Active playlist id / item order / durations / transitions
- Asset sha256 or version for referenced media
- Active scene id
- Takeover id / endsAt
- `reloadNonce`
- Fallback playlist id

Stable when only heartbeat telemetry changes.

Use same semantic clock for LED playlist `startedAt` as today (`activated_at`) so Mac player and OBS agent stay aligned.

---

## 7. Error handling

| Code | Meaning | Client action |
|------|---------|---------------|
| 304 | Manifest unchanged | Keep current |
| 401 | Bad/revoked token | Stop downloads; keep last-known-good playback; show re-pair |
| 403 | Not allowed for asset | Skip asset; report error; do not tight-loop |
| 404 | Unknown asset/route | Skip; report |
| 409 | Manifest/asset not ready server-side | Backoff |
| 429 | Rate limited | Exponential backoff |
| 503 | Backend/migrations | Keep last-known-good; backoff |

**Anti-storm:** Cap concurrent downloads (1–3). Cap retries per asset. Global backoff on consecutive 5xx. Honor optional daily bandwidth budget from heartbeat.

---

## 8. Content hash pipeline

1. On upload (LED, vertical ads, artist LED, specials images): compute sha256 + size in browser or via edge function; store in `media_content_hashes` / columns.
2. Backfill job for existing `screen-ads` objects (one-time egress cost — schedule off-peak, count against budget).
3. Manifest refuses to mark asset downloadable until hash present (or falls back to temporary size-only with warning — prefer fail closed for integrity).

---

## 9. Security requirements (API)

- Asset id ≠ authorization.
- Storage paths never accepted from client as proof of access.
- Short-lived signed download URLs.
- Pairing codes single-use, short TTL (e.g. 10 minutes), hashed at rest.
- Revocation immediate for new grants; in-flight signed URLs expire naturally.
- No service-role in clients.
- Validate `kind` vs pairing intent (vertical code cannot mint led_runner if policy forbids).
- Log retention: auth failures without raw tokens; metrics without signed URL query strings.

---

## 10. Example client flows

### First boot (Mac)

1. Pair → store token.
2. Heartbeat → learn revision.
3. GET manifest → enqueue assets.
4. POST download per asset → verify → SQLite ready.
5. Start HTTP `:4173` → OBS Browser Source `/wall`.
6. Heartbeat drives `desiredObsScene` (or legacy sync).

### Takeover (Android)

1. Heartbeat `manifestChanged: true`.
2. Manifest includes `takeover` + asset.
3. Download if needed → atomic switch → play takeover until `endsAt` or clear.
4. Restore prior playlist pointer without re-downloading unchanged hashes.
