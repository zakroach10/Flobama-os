# FloBama Server Station — Architecture Plan

## Goal

Touchscreen-first kiosk for floor staff at FloBama Music Hall: answer guest questions, switch approved LED scenes, and create temporary wall graphics (specials, birthdays, messages) with phone QR upload — without a second LED controller or auth backend.

## Reuse

| Area | Existing pieces |
| --- | --- |
| Auth shell | Wall Ops dedicated console, restricted menus, persistent cookies |
| Staff CRUD | `createStaffAction`, Settings staff directory |
| LED activate | `activateLedWallSceneAction`, `activateLedPlaylistAction`, `activateDefaultAdRollAction` |
| House rotation | `led_wall_playlists` + `default_playlist_id` |
| Phone QR | HMAC upload tokens + `/wall/upload` prepare/complete APIs |
| Media cache | `media_content_hashes`, Local Runner manifest |
| Events | `events` + `event_artists` published public fields |
| Temporary pattern | Vertical `screen_takeovers` → mirrored as LED overrides |

## New pieces

1. **`server` staff role** — Server Station only; no admin/config deletes.
2. **`server` menu** → `/server` dedicated dark kiosk shell.
3. **Kiosk device sessions** — hashed device tokens (display-device style); admin provision/revoke.
4. **Staff PIN overlay** — scrypt hashes; rate-limited verify; inactivity lock without dropping device session.
5. **LED server items** — temporary media scenes + playlist membership + expiration.
6. **LED wall overrides** — timed “Show Now” with server-side expiration and recomputed restore (not blind stale restore).
7. **`server_approved` on scenes** — servers may activate only approved scenes.
8. **Server Station settings + audit log**.
9. **Client canvas → optimized PNG** for templates (no Canva); hashed once for Local Runner.

## Auth model

- **Admin/Manager**: existing Supabase session; can open `/server` without losing privileges.
- **Server accounts**: role `server`, menus locked to Server Station; optional PIN for kiosk attribution.
- **Kiosk**: provisioned device cookie + PIN identity cookie. No service-role keys in the browser. Every action re-validates on the server.

## Playback priority (enforced)

1. Admin emergency / manual override (existing trivia/audience protected)
2. Protected live band / scheduled program (`artist_auto`, trivia, audience)
3. Approved temporary birthday/message override (`server_override`)
4. Scheduled LED content
5. Default house advertising playlist

Show Now during protected modes offers **queue for rotation** instead of interrupting.

## Security risks addressed

- PIN brute force → rate limit + lockout
- QR token reuse → short TTL, single-use session binding
- Privilege escalation → authorize* on every action; servers cannot configure LED/OBS/devices
- Bandwidth → optimized PNG/WebP, content hashes, no image blobs in DB rows
- Concurrent overrides → single row per venue + upsert with expiration checks

## Backward compatibility

- Wall Ops, admin Screens, Local Runner, artist auto-roll, and vertical specials unchanged.
- New migrations are additive; missing-table helpers keep older DBs from crashing UI.

## Deployment

1. Apply `20261017000050_server_role.sql`, then `20261017000051_server_station.sql`.
2. Existing env vars only (`CRON_SECRET` or service role for upload tokens / cron).
3. Cron `/api/cron/led-wall` also expires server overrides and temporary slides.
4. Admin: Settings → Server Station — approve scenes, set playlist, provision kiosk, set staff PINs.
