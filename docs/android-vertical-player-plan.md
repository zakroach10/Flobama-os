# FloBama Vertical Player — Android APK Plan

**Status:** Planning document.  
**Depends on:** [local-media-architecture.md](./local-media-architecture.md), [media-sync-api-contract.md](./media-sync-api-contract.md)  
**Replaces (at edge):** browser open to `/display/vertical` on the two 48″ vertical kiosks.

---

## 1. Purpose

FloBama Vertical Player is an installable Android APK that:

- Registers as a venue display device
- Downloads assigned vertical playlist / takeover media once
- Plays portrait 9:16 content fullscreen offline
- Reports health and accepts remote playlist/takeover/refresh commands via FloBama OS
- Reuses existing Screens ads, playlists, specials, week-events, and takeover admin — no parallel ad CMS

---

## 2. Current state (repo audit)

| Item | Status |
|------|--------|
| Web vertical player | Exists: `/display/vertical`, `VerticalPlayer`, 4s poll |
| Staff admin | Exists: ads, playlists, specials, takeover panels |
| Android sources / APK | **None** |
| Device identity for TVs | **None** (public URL) |
| Offline media cache | **None** (RAM keep-last-poll only) |

---

## 3. Playback engine recommendation

| Option | Pros | Cons |
|--------|------|------|
| **Native Media3 / ExoPlayer (adopt)** | Stable 24/7 looping, local file URIs, gapless-ish transitions, lower WebView leak risk, true offline | Must reimplement playlist/transitions in Kotlin; week_events needs alternate render |
| WebView wrapping `/display/vertical` | Fastest UI parity | Memory pressure, media quirks, still tempted to hit network URLs, weaker offline story |

**Decision:** Native **Media3 (ExoPlayer)** for video/image playlist playback.

**Week events slide:** Either (a) fetch rendered image/PDF from existing `/api/public/v1/screens/week/social` (or a dedicated still endpoint) and cache as an image asset, or (b) lightweight WebView **only** for that slide type. Prefer (a) for kiosk stability.

Transitions: implement cut / fade in the player UI layer; slide transition if feasible without WebView.

---

## 4. APK architecture

```text
┌────────────────────────────────────────────┐
│ FloBama Vertical Player                    │
│  ┌─────────────┐  ┌────────────────────┐   │
│  │ Pairing UI  │  │ Device auth store  │   │
│  └──────┬──────┘  └─────────┬──────────┘   │
│         ▼                   ▼              │
│  ┌─────────────────────────────────────┐   │
│  │ Sync worker (WorkManager)           │   │
│  │  heartbeat · manifest · downloads   │   │
│  └──────────────────┬──────────────────┘   │
│                     ▼                      │
│  ┌─────────────────────────────────────┐   │
│  │ Media cache (files + Room/SQLite)   │   │
│  └──────────────────┬──────────────────┘   │
│                     ▼                      │
│  ┌─────────────────────────────────────┐   │
│  │ PlayerActivity (immersive 9:16)     │   │
│  │  ExoPlayer + image slides           │   │
│  └─────────────────────────────────────┘   │
│  Boot receiver / foreground service        │
└────────────────────────────────────────────┘
```

### 4.1 Proposed project location

New top-level (or `clients/`) Android project:

```text
clients/android-vertical-player/
  app/
  README.md
```

Distribution: versioned APK under `public/downloads/` + Screens download/instructions panel (mirror Mac DMG pattern). Constants in `src/lib/constants.ts`.

### 4.2 Tech stack

- Kotlin, Android Gradle Plugin, minSdk appropriate to kiosk hardware (verify on device; plan for API 24+ with preference for 26+)
- Media3 ExoPlayer
- Room (or SQLite) for asset index
- OkHttp / Ktor for API
- WorkManager for background sync
- EncryptedSharedPreferences or Keystore-backed storage for device token
- No Supabase SDK with service-role; only FloBama agent HTTPS APIs

---

## 5. Device registration

Mirror Mac Camera pairing (`createCameraPairingCodeAction`, `/api/agent/v1/cameras/pair`):

1. APK shows setup screen + generated or entered **pairing code** flow.
2. Preferred UX: Admin creates code in Screens → Device enters code → server returns device id + token once.
3. Associate device with **venue** + **screen role** `vertical_kiosk` (+ optional label “Kiosk A/B”).
4. Token stored hashed server-side; raw token only on device.
5. Revoke from Screens → device stops receiving manifests; local last-known-good may continue until policy forces lock screen message.
6. Online/offline from heartbeat `last_seen_at` (stale e.g. 60–120s given WorkManager cadence).

**Never** embed Supabase service-role or anon keys for privileged writes in the APK. If anon is ever needed for public reads during migration, treat as temporary and prefer device Bearer APIs.

---

## 6. Persistent offline media cache

Rules (shared with Mac):

- Download assigned assets once; store in app-private storage.
- Track `assetId`, `version`, `sha256`, `sizeBytes`, `state`.
- Background download new campaign assets without interrupting current playlist.
- **Atomic activation:** new playlist becomes current only when every required asset is `ready` and verified.
- Do not delete active/pinned media mid-play.
- Support large videos and images; respect free-space watermark.
- Continue playback with zero internet using last-known-good manifest pointer.

Checksum verify before promotion from `tmp/` to final file.

---

## 7. Vertical display playback requirements

| Requirement | Approach |
|-------------|----------|
| Portrait 9:16 | Lock orientation; layout for physical panel (typically 1080×1920 logical) |
| Fullscreen immersive | Hide system bars; sticky immersive |
| Video + image playlists | ExoPlayer + ImageView/Coil |
| Slide durations | Honor `durationSeconds` / `holdMsForAd` semantics from FloBama |
| Seamless loops | ExoPlayer repeat / playlist queue |
| Transitions | cut / fade (slide best-effort) |
| Scheduled campaigns | Expressed via FloBama playlist + cron/admin; device consumes manifest |
| Advertising takeovers | Manifest marks takeover assets + `endsAt`; interrupt schedule atomically when ready |
| Default fallback playlist | Server-provided `fallbackPlaylistId` or last-known-good |
| Crash recovery | Process restart → resume playlist index from wall-clock schedule if provided, else start of current item |
| Relaunch after reboot | `BOOT_COMPLETED` receiver starts player (ordinary app capability) |
| 24/7 unattended | Foreground service with ongoing notification where required by Android version |

Match existing vertical semantics from `src/components/screens/vertical-player.tsx` and `src/lib/screens/playlist.ts` where practical (duration null for video → play to end; week_events min duration; takeover override).

---

## 8. Kiosk lockdown capability matrix

Differentiate **ordinary app** vs **privileged** features. Do **not** assume Device Owner without verifying the two kiosk units.

| Capability | Ordinary app | Device Owner / MDM / vendor |
|------------|--------------|-----------------------------|
| Immersive fullscreen | Yes | — |
| Keep screen on (`FLAG_KEEP_SCREEN_ON`) | Yes | — |
| Start on boot | Yes (with permission; OEM may restrict) | More reliable via MDM |
| Prevent Recents / accidental exit | Partial (sticky immersive) | **Lock task mode** |
| Pin app (screen pinning) | User-assisted | Programmatic lock task |
| Disable status bar / power nav | Limited | Device Owner / vendor kiosk API |
| Silent install / update | No | MDM |
| Remote reboot OS | No | MDM / vendor |
| Remote “safe refresh” app | Yes (in-app command via manifest/heartbeat) | — |
| Hardware watchdog | Vendor-specific | Verify with manufacturer |

**Ship order**

1. Immersive player + boot start + foreground service + remote soft refresh.
2. Document OEM model / Android version / enrollment options.
3. If hardware supports Device Owner or vendor kiosk mode, add lock-task in a follow-on build.

---

## 9. Remote control via FloBama OS

Administrators (existing Screens workflows + new device panel) must:

| Action | Mechanism |
|--------|-----------|
| Assign playlists | Existing playlist activate → reflected in device manifest |
| Schedule advertising | Existing specials windows / playlist composition |
| Temporary takeover | Existing `screen_takeovers` → manifest takeover block |
| Restore regular programming | Clear takeover |
| View download progress | Device status reports |
| Current playback info | Heartbeat fields (`currentAssetId`, index) |
| Last sync time | `last_seen_at` / `lastManifestAt` |
| Offline devices | Stale heartbeat UI |
| Device health | Disk, cache, errors, app version |
| Safe refresh | Command bit / nonce in heartbeat response (reload player without wiping cache) |
| Campaign playback records | Optional later: local play logs uploaded on sync (privacy-minimized) |

Do **not** rebuild a separate advertisement administration system.

---

## 10. Sync cadence

- Heartbeat / command poll: every 15–30s while online (battery irrelevant for plugged kiosk; still avoid 1s thrash).
- Manifest body: only when `revision` changes (`ETag` / 304).
- Downloads: parallel limit 1–2 large files to protect venue WAN.
- On reconnect: catch up manifest, download gaps, then activate.

---

## 11. Security notes (Android-specific)

- Device token in Keystore-backed storage.
- No logging of Bearer tokens.
- Certificate pinning optional later; require HTTPS to FloBama API.
- Verify APK signature for updates; prefer staff sideload of known DMG/APK from FloBama downloads until Play/MDM exists.
- Cleartext HTTP disabled except during lab builds.
- Revocation must work even if device is stolen (stop grants; optional wipe-config command).

---

## 12. Deployment on venue hardware

1. Confirm Android version, storage size, codec support (H.264/H.265), orientation sensors/locked panel.
2. Sideload APK (USB / managed download).
3. Pair with Screens code; assign “Vertical Kiosk A”.
4. Wait until cache shows 100% ready before removing browser kiosk URL.
5. Pilot one kiosk (migration Stage 4); then second.

Rollback: reopen Chrome/WebView to hosted `/display/vertical`.

---

## 13. Development task breakdown

1. Android project skeleton + immersive PlayerActivity.
2. Pairing + secure token storage.
3. Manifest client + Room cache + downloader + verify.
4. ExoPlayer playlist engine matching duration/takeover rules.
5. Week-events still caching strategy.
6. WorkManager heartbeat + status reporting.
7. Boot / crash recovery.
8. Screens admin device panel hooks.
9. Hardware pilot matrix (lockdown verification).
10. APK build pipeline → `public/downloads/`.

---

## 14. Risks

| Risk | Mitigation |
|------|------------|
| OEM kills background sync | Foreground service; OEM battery whitelist docs |
| Codec mismatch | Transcode guidance on upload; probe on device |
| WebView week_events complexity | Prefer still image cache |
| Staff expect browser reload button behavior | Map refresh-wall nonce to soft player restart |
| Dual kiosks share playlist but duplicate downloads | Accept 2× seed cost; still tiny vs streaming |
