# Legacy event manager API

Server-to-server API for the HighLevel AI Studio event manager. It reads and writes the existing FloBama OS `public.events` rows. It does not create a second event, artist, or calendar database.

## Delivery status

| Item | State |
| --- | --- |
| Code | Implemented in this repository on branch `cursor/event-integration-api-c9f3`. |
| Database migration | Written as `supabase/migrations/20261103000063_event_integration.sql`. It was **not** applied to the hosted Supabase project in this change. |
| Application deploy | **Not deployed.** `https://flobama-os.vercel.app` does not serve these routes until this branch is merged and the Next.js app is deployed. |
| Live verification | **Not done.** No production credential was minted. No test event was written to the live website. |
| Automated checks on this branch | `npx tsc --noEmit` passed. `npx eslint` on the integration files passed. `npx vitest run` — 371 tests passed, 1 skipped. Two suites (`tests/ecamm-controller.test.ts`, `tests/ecamm-parsers.test.ts`) failed to load because `clients/local-runner` cannot import `bonjour-service`. Those suites are unrelated to this API and were not modified. |

Do not point AI Studio at production until the migration is applied and the app deploy is live. Calls made before that will 404, or return `not_configured` if the app is deployed without `SUPABASE_SERVICE_ROLE_KEY`.

## Production base URL

After deployment:

```text
https://flobama-os.vercel.app
```

AI Studio server environment:

| Variable | Where | Purpose |
| --- | --- | --- |
| `FLOBAMA_OS_API_BASE_URL` | AI Studio **server** only | `https://flobama-os.vercel.app` |
| `FLOBAMA_OS_INTEGRATION_TOKEN` | AI Studio **server** only | Bearer token minted by the script below. Never put this in the HighLevel browser app, a public env, or a client bundle. |

FloBama OS already uses `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on its own server. Those stay on FloBama OS. Do not copy the service-role key to AI Studio. The integration token is not stored in the OS environment; only its SHA-256 hash is stored in `integration_credentials`.

## Authentication

Every integration route requires:

```http
Authorization: Bearer fbint_EXAMPLE_NOT_A_REAL_SECRET
```

The token format is `fbint_` plus 32 random bytes encoded as base64url. The OS stores `sha256(utf8(token))` and compares it in constant time. A missing token, an unknown token, and a revoked token all return the same 401 body so callers cannot tell those cases apart.

The credential is the integration's identity. It is not a staff login. `created_by` and `updated_by` on events stay null for these writes, because there is no `auth.uid()`. Optional attribution uses a separate header and is not trusted as an OS user:

```http
X-Integration-Actor: studio-user-jane
```

That value is stored on the audit row as `reported_actor`. Control characters are stripped. It is truncated to 120 characters. It is never used to authorize the request.

Each credential is bound to one venue. The mint script defaults to FloBama:

```text
11111111-1111-4111-8111-111111111111
```

Clients cannot pass `venueId`. A request for an event or artist outside that venue returns 404, including lookup by id, so the API does not reveal that the row exists in another venue.

### Scopes

| Scope | Routes |
| --- | --- |
| `events:read` | `GET /api/integrations/v1/events`, `GET /api/integrations/v1/events/:id` |
| `events:write` | `POST /api/integrations/v1/events`, `PATCH /api/integrations/v1/events/:id` |
| `artists:read` | `GET /api/integrations/v1/artists` |
| `artwork:write` | `POST /api/integrations/v1/artists/:id/artwork/uploads`, `POST /api/integrations/v1/artists/:id/artwork` |

The default mint grants all four. `GET` by id is `events:read`. The SQL read used internally while applying a `PATCH` also accepts `events:write`, so a write-only credential can reload the row it is editing. Listing still requires `events:read`.

### Generate, rotate, and revoke

**Preferred:** FloBama OS → **Settings → Integrations → Legacy event manager API** (admins only).

1. Name the credential (for example `HighLevel AI Studio`).
2. Choose permissions. For AI Studio today, use `events:read`, `events:write`, and `artists:read`. Leave `artwork:write` off unless you need signed artwork uploads.
3. Click **Generate token**. Copy the token immediately — FloBama OS stores only a hash and will not show the full token again.
4. Put these on the AI Studio **server** only:

```text
FLOBAMA_OS_API_BASE_URL=https://flobama-os.vercel.app
FLOBAMA_OS_INTEGRATION_TOKEN=<paste the generated token>
```

5. To rotate: generate a second credential, switch AI Studio to the new token, confirm a `GET /api/integrations/v1/events?limit=1`, then click **Revoke** on the old row.
6. Revocation is immediate. The next request with the old token is 401. There is no way to recover a token from the hash; mint a new one.

Optional CLI (trusted machine with `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; never print those values into chat or tickets):

```bash
node scripts/integration-credential.mjs create \
  --name "HighLevel AI Studio" \
  --venue 11111111-1111-4111-8111-111111111111 \
  --scopes events:read,events:write,artists:read

node scripts/integration-credential.mjs list
node scripts/integration-credential.mjs revoke --id <credential-uuid>
```

## Routes

There is no delete route. Cancellation and unpublishing go through `PATCH`.

| Method | Path | Success |
| --- | --- | --- |
| `GET` | `/api/integrations/v1/events` | 200 |
| `GET` | `/api/integrations/v1/events/:id` | 200 |
| `POST` | `/api/integrations/v1/events` | 201 |
| `PATCH` | `/api/integrations/v1/events/:id` | 200 |
| `GET` | `/api/integrations/v1/artists` | 200 |
| `POST` | `/api/integrations/v1/artists/:id/artwork/uploads` | 200 |
| `POST` | `/api/integrations/v1/artists/:id/artwork` | 200 |

`POST` and `PATCH` bodies are `Content-Type: application/json` and at most 65536 bytes. Responses send `Cache-Control: no-store` and `X-Request-Id`.

Send `X-Request-Id` as 8–80 characters matching `[A-Za-z0-9_-]+` to correlate logs. Any other value is replaced with a generated `req_…` id. The same id is in the JSON body.

## Event record

Times in `startDate`, `startTime`, `endDate`, and `endTime` are America/Chicago wall times (`HH:mm`, 24-hour). `startsAt` and `endsAt` are timezone-aware instants (ISO-8601, typically `Z`). Storage is `timestamptz`. `timeZone` is always `America/Chicago`.

`POST` returns 201. `GET` by id and `PATCH` return 200. All three use this envelope:

```json
{
  "event": {
    "id": "55555555-5555-4555-8555-555555555555",
    "venueId": "11111111-1111-4111-8111-111111111111",
    "title": "Late set",
    "publicDescription": "Doors at 8.",
    "internalNotes": "Load-in at 5.",
    "eventType": "live_music",
    "startsAt": "2026-06-13T02:00:00.000Z",
    "endsAt": "2026-06-13T06:30:00.000Z",
    "startDate": "2026-06-12",
    "startTime": "21:00",
    "endDate": "2026-06-13",
    "endTime": "01:30",
    "timeZone": "America/Chicago",
    "locationLabel": "Main room",
    "status": "published",
    "visibility": "public",
    "featured": false,
    "archivedAt": null,
    "isTicketed": true,
    "ticketUrl": "https://tickets.example.test/late-set",
    "coverLabel": "$10",
    "artists": [
      {
        "id": "33333333-3333-4333-8333-333333333333",
        "name": "The Steel Woods",
        "displayOrder": 0,
        "artwork": null
      }
    ],
    "createdAt": "2026-06-01T18:00:00.000Z",
    "updatedAt": "2026-06-01T18:00:00.000Z",
    "publiclyListed": true
  },
  "requestId": "req_create_1"
}
```

`publiclyListed` is computed. It is true only when `status` is `published`, `visibility` is `public`, and `archivedAt` is null. That is the same rule as the public `event_listings` view. It is not writable.

`internalNotes` is returned to this integration. It is never included in `GET /api/public/v1/events`.

Artwork on the event is the artist's current LED-wall graphic, read live on `GET`. A `POST` replay returns the artwork snapshot from the original create, not a later upload.

### Enums

- `eventType`: `live_music`, `karaoke`, `dj`, `sports`, `private_event`, `other`
- `status`: `draft`, `published`, `cancelled`
- `visibility`: `public`, `private`

### Writable on create

Required: `title`, `eventType`, `startDate`, `startTime`, `endDate`, `endTime`, `status`, `visibility`.

Optional, with defaults: `timeZone` (`America/Chicago`), `featured` (`false`), `isTicketed` (`false`), `artistIds` (`[]`).

Nullable text, omit or send null: `locationLabel` (max 160), `publicDescription` (max 8000), `internalNotes` (max 8000), `ticketUrl` (max 500, must start with `http://` or `https://` when set), `coverLabel` (max 40).

`title` is 1–200 characters after trim. `artistIds` is an array of existing artist UUIDs in this venue, unique, at most 20. Order is the lineup order (`displayOrder` 0, 1, 2, …). Artists are optional. This API does not create artists.

If `timeZone` is sent, it must be `America/Chicago`. `null` is rejected. Any other zone is rejected.

An empty string on a nullable text field is rejected. Send `null` to clear it, or omit it.

### Writable on update

Same fields as create, plus `archived` (`true` or `false`). Send only the fields that change. Omitted fields stay as they are. Explicit `null` clears only the nullable text fields above. `artistIds: []` removes the lineup. `artistIds: null` is rejected.

`archived: true` sets `archived_at` if it was null. `archived: false` clears `archived_at`. Do not send `archivedAt`.

### Protected fields

These are rejected on create and update:

`id`, `venueId`, `venue_id`, `createdAt`, `created_at`, `updatedAt`, `updated_at`, `createdBy`, `created_by`, `updatedBy`, `updated_by`, `legacySourceId`, `legacy_source_id`, `archivedAt`, `archived_at`, `publiclyListed`, `artists`, `artwork`, `publicUrl`, `storagePath`, `startsAt`, `endsAt`.

Use `startDate` / `startTime` / `endDate` / `endTime` for the schedule. Use `artistIds` for the lineup. Use the artwork routes for the LED graphic. Use `archived` to archive. Concurrency uses the `If-Match` header, not a body `updatedAt`.

### Publication and cancellation

Any status may move to any status, including on an archived row. That matches a staff event save.

| Goal | PATCH |
| --- | --- |
| Publish on the public feed | `{ "status": "published", "visibility": "public", "archived": false }` |
| Unpublish, keep the row editable | `{ "status": "draft" }` |
| Cancel | `{ "status": "cancelled" }` |
| Hide without changing status | `{ "visibility": "private" }` |
| Archive | `{ "archived": true }` |
| Restore an archived row | `{ "archived": false }` |

The public feed (`GET /api/public/v1/events` and `GET /api/public/v1/events/:id`) lists a row only when it is published, public, and not archived. Draft, cancelled, private, and archived events stay out of that feed. This integration does not change the public response shape. A successful create or update invalidates the same paths the staff event save invalidates, including `/api/public/v1/events`, `/api/public/v1/now`, `/programming`, `/embed/events`, and the screen feeds, plus `/programming/:id` and `/programming/:id/edit`. An idempotent replay does not invalidate again. A cache failure is logged and does not fail the write.

This migration does not update existing events. Creating one event does not change any other event's status.

There is no hard delete.

### Timezone

Staff-facing fields are America/Chicago. An event that ends after midnight uses the next calendar date for the end.

June 12, 2026, 21:00 through June 13, 2026, 01:30 in Chicago is stored as:

```text
startsAt 2026-06-13T02:00:00.000Z
endsAt   2026-06-13T06:30:00.000Z
```

January 15, 2026, 20:00 Chicago (CST, UTC−6) is `2026-01-16T02:00:00.000Z`.

The spring-forward gap is rejected. `2026-03-08` at `02:30` America/Chicago does not exist. The fall-back overlap is rejected. `2025-11-02` at `01:30` America/Chicago happens twice; pick a time outside the repeated hour. `end` must be after `start`.

## List events

```bash
curl -sS "$FLOBAMA_OS_API_BASE_URL/api/integrations/v1/events?from=2026-06-12&to=2026-06-12&status=published&limit=50" \
  -H "Authorization: Bearer $FLOBAMA_OS_INTEGRATION_TOKEN" \
  -H "X-Request-Id: req_list_events_1"
```

Query parameters:

| Param | Meaning |
| --- | --- |
| `from` | Inclusive lower bound on `starts_at`. `YYYY-MM-DD` is midnight America/Chicago that day. An ISO timestamp is used as an instant. |
| `to` | Inclusive upper bound on `starts_at`. `YYYY-MM-DD` is 23:59:59.999 America/Chicago that day. This filters the start, not events that merely overlap the range. |
| `status` | `draft`, `published`, `cancelled`, a comma-separated list, or `all`. Default is all statuses. |
| `visibility` | `public` or `private`. Omit for both. |
| `includeArchived` | `1` or `true` includes archived rows. Omit, `0`, or `false` for active rows only. Any other value is 400. Default is active only. |
| `limit` | 1–100. Default 50. |
| `cursor` | Opaque `nextCursor` from the previous page. Do not build this value. |

`GET /api/integrations/v1/events/:id` returns an archived event. The list does not, unless `includeArchived` is set. An unknown id, a bad UUID, and another venue's id are all 404.

```json
{
  "events": [],
  "page": { "limit": 50, "hasMore": false, "nextCursor": null },
  "requestId": "req_list_events_1"
}
```

When `hasMore` is true, pass `page.nextCursor` as `cursor`. Ordering is `starts_at`, then `id`.

## Create

`Idempotency-Key` is required. Pattern: `[A-Za-z0-9._:-]{8,200}`.

The server hashes the normalized body (defaults applied, keys sorted), not the raw bytes. The same key and the same normalized payload return the original 201 body, even if a later edit changed the live row. That replay is the create-time snapshot. The same key with a different normalized payload returns 409 `idempotency_conflict` and does not write. A key that is still inside the create transaction returns 409 `idempotency_in_progress`; retry the same request. Validation failures do not consume the key. The event insert and the idempotency row commit or roll back together. Two concurrent requests with the same key and payload create one event.

Omitted `featured` and `"featured": false` are the same payload. `"title": "Late set"` and `"title": "Different title"` are not.

```bash
curl -sS -D - "$FLOBAMA_OS_API_BASE_URL/api/integrations/v1/events" \
  -H "Authorization: Bearer $FLOBAMA_OS_INTEGRATION_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: ai-studio-late-set-2026-06-12" \
  -H "X-Integration-Actor: studio-user-jane" \
  -H "X-Request-Id: req_create_1" \
  --data '{
    "title": "Late set",
    "eventType": "live_music",
    "startDate": "2026-06-12",
    "startTime": "21:00",
    "endDate": "2026-06-13",
    "endTime": "01:30",
    "status": "published",
    "visibility": "public",
    "artistIds": ["33333333-3333-4333-8333-333333333333"],
    "publicDescription": "Doors at 8.",
    "internalNotes": "Load-in at 5.",
    "isTicketed": true,
    "ticketUrl": "https://tickets.example.test/late-set",
    "coverLabel": "$10",
    "locationLabel": "Main room"
  }'
```

Save `event.id` and `event.updatedAt` from the response.

Use `status: "draft"` and `visibility: "private"` for anything that must not appear on the public site. A published public event is eligible for the existing public feed.

## Update

`If-Match` is required. Set it to the `updatedAt` string from the event you loaded. Send it raw or as a quoted ETag. A weak `W/` prefix is stripped. `*` and comma-separated lists are rejected. Compare instants: `Z` and `+00:00` match. Do not reformat the value with `Date.toISOString()` if that would drop microseconds; pass the string you received.

Missing `If-Match` is 428 `precondition_required`. A stale value is 409 `edit_conflict`, and the body includes `currentUpdatedAt` for the row that won. The stale write is not applied. An empty object is 400.

```bash
curl -sS "$FLOBAMA_OS_API_BASE_URL/api/integrations/v1/events/55555555-5555-4555-8555-555555555555" \
  -X PATCH \
  -H "Authorization: Bearer $FLOBAMA_OS_INTEGRATION_TOKEN" \
  -H "Content-Type: application/json" \
  -H "If-Match: 2026-06-01T18:00:00.000Z" \
  -H "X-Request-Id: req_patch_1" \
  --data '{ "coverLabel": "$15" }'
```

The response is the saved event. Use its new `updatedAt` for the next `If-Match`.

Cancel:

```bash
curl -sS "$FLOBAMA_OS_API_BASE_URL/api/integrations/v1/events/55555555-5555-4555-8555-555555555555" \
  -X PATCH \
  -H "Authorization: Bearer $FLOBAMA_OS_INTEGRATION_TOKEN" \
  -H "Content-Type: application/json" \
  -H "If-Match: 2026-06-01T18:04:00.000Z" \
  --data '{ "status": "cancelled" }'
```

## Artists

Look up an artist before attaching an id. Do not invent ids and do not expect this API to create one.

```bash
curl -sS "$FLOBAMA_OS_API_BASE_URL/api/integrations/v1/artists?query=Steel&limit=25" \
  -H "Authorization: Bearer $FLOBAMA_OS_INTEGRATION_TOKEN"
```

`query` is optional. Allowed characters are letters, numbers, spaces, and `. & ' ’ + -`, up to 160 characters. Matching is case-insensitive on name or genre. Only active artists in the credential's venue are returned.

```json
{
  "artists": [
    {
      "id": "33333333-3333-4333-8333-333333333333",
      "name": "The Steel Woods",
      "genre": "country",
      "artwork": {
        "mediaKind": "image",
        "publicUrl": "https://example.supabase.co/storage/v1/object/public/screen-ads/11111111-1111-4111-8111-111111111111/led/artists/33333333-3333-4333-8333-333333333333-ab12cd34.png",
        "enabled": true
      }
    }
  ],
  "page": { "limit": 25, "hasMore": false, "nextCursor": null },
  "requestId": "req_artists_1"
}
```

`limit` is 1–50, default 25. The server scans at most 500 matching artists per request before applying the cursor, so a venue with more than 500 active matches needs a narrower `query`. `artwork` is null when the artist has no LED graphic.

Put the chosen ids in `artistIds` on create or patch. An id from another venue, an unknown id, or an archived artist is `invalid_input` on `artistIds`.

## Artwork

Events do not have their own image column. The show graphic is the artist LED-wall scene in the existing public `screen-ads` bucket, path `{venueId}/led/artists/{artistId}-{suffix}.{ext}`. The same row the staff artist page writes. The public events JSON does not grow a new image field; screens that already read the artist LED graphic pick it up.

The AI Studio backend performs all three steps. The browser does not see the integration token. Do not log `signedUrl` or `token`.

1. Prepare a signed upload.

```bash
curl -sS "$FLOBAMA_OS_API_BASE_URL/api/integrations/v1/artists/33333333-3333-4333-8333-333333333333/artwork/uploads" \
  -H "Authorization: Bearer $FLOBAMA_OS_INTEGRATION_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{ "contentType": "image/png", "byteSize": 482113 }'
```

```json
{
  "upload": {
    "storagePath": "11111111-1111-4111-8111-111111111111/led/artists/33333333-3333-4333-8333-333333333333-ab12cd34.png",
    "signedUrl": "https://PROJECT.supabase.co/storage/v1/object/upload/sign/screen-ads/...?token=SHORT_LIVED",
    "token": "SHORT_LIVED",
    "contentType": "image/png",
    "maxBytes": 8388608,
    "method": "PUT",
    "expiresInSeconds": 7200
  },
  "requestId": "req_art_1"
}
```

Allowed types:

| Content-Type | Max size |
| --- | --- |
| `image/png`, `image/jpeg`, `image/heic`, `image/heif` | 8388608 bytes (8 MiB) |
| `video/mp4` | 2147483648 bytes (2 GiB, same as the staff LED upload) |

2. `PUT` the raw bytes to `signedUrl`. The URL already contains the upload token. Do not send the integration bearer token to Storage.

```bash
curl -sS -X PUT "$SIGNED_URL" \
  -H "Content-Type: image/png" \
  -H "Cache-Control: max-age=3600" \
  --data-binary @artwork.png
```

3. Complete, using the `storagePath` from step 1. Do not send `publicUrl`. The object must exist, and the content type must match the file extension.

```bash
curl -sS "$FLOBAMA_OS_API_BASE_URL/api/integrations/v1/artists/33333333-3333-4333-8333-333333333333/artwork" \
  -H "Authorization: Bearer $FLOBAMA_OS_INTEGRATION_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "storagePath": "11111111-1111-4111-8111-111111111111/led/artists/33333333-3333-4333-8333-333333333333-ab12cd34.png",
    "contentType": "image/png"
  }'
```

```json
{
  "artwork": {
    "artistId": "33333333-3333-4333-8333-333333333333",
    "storagePath": "11111111-1111-4111-8111-111111111111/led/artists/33333333-3333-4333-8333-333333333333-ab12cd34.png",
    "mediaKind": "image",
    "publicUrl": "https://PROJECT.supabase.co/storage/v1/object/public/screen-ads/11111111-1111-4111-8111-111111111111/led/artists/33333333-3333-4333-8333-333333333333-ab12cd34.png",
    "enabled": true
  },
  "requestId": "req_art_2"
}
```

A later `GET` of an event that includes this artist returns that artwork. Completing artwork also revalidates `/artists`, `/artists/:id`, `/screens`, `/display/led`, and `/api/public/v1/screens/led`.

## Errors

```json
{
  "error": {
    "code": "invalid_input",
    "message": "Check the highlighted fields.",
    "requestId": "req_create_1",
    "fieldErrors": {
      "startTime": [
        "That local time does not exist in America/Chicago (often during a spring-forward daylight-saving gap). Choose another time."
      ]
    }
  }
}
```

`fieldErrors` is omitted when there is no field to point at. `currentUpdatedAt` is present on `edit_conflict` only. Database errors are not returned. Tokens are redacted before anything is logged.

| HTTP | `error.code` | When |
| --- | --- | --- |
| 400 | `invalid_input` | Schema, timezone, unknown field, protected field, empty patch, bad query, bad artists |
| 400 | `invalid_json` | Body is not JSON |
| 400 | `missing_idempotency_key` | `POST` without a valid `Idempotency-Key` |
| 401 | `unauthorized` | Missing, unknown, or revoked credential. Same message for all three |
| 403 | `forbidden` | Credential is valid but lacks the scope |
| 404 | `not_found` | Unknown id, bad UUID, or a row outside the credential venue |
| 409 | `idempotency_conflict` | Key reused with a different normalized body |
| 409 | `idempotency_in_progress` | Same key is still being processed. Retry the same body |
| 409 | `edit_conflict` | `If-Match` is older than `updated_at` |
| 413 | `payload_too_large` | Body over 65536 bytes |
| 415 | `unsupported_media_type` | Not `application/json` |
| 428 | `precondition_required` | `PATCH` without `If-Match` |
| 429 | `rate_limited` | See below. `Retry-After` is set |
| 500 | `server_error` | Unexpected failure. Generic message |
| 503 | `not_configured` | Service role or integration schema is not available |

Successful responses include `X-RateLimit-Limit` and `X-RateLimit-Remaining`.

Rate limits, both required: 120 requests per 60 seconds per credential, and 60 requests per 60 seconds per hashed client IP. The window is stored in Postgres so it holds across serverless instances. If the rate-limit table is missing, the API fails closed with 503. Other rate-limit failures fail closed with 500. Unauthenticated 401s are not written to the audit log.

## Audit

Authenticated calls append `integration_audit_log`: venue, credential id, action (`events.list`, `events.read`, `events.create`, `events.update`, `artists.list`, `artwork.prepare`, `artwork.complete`, `rate_limited`, `forbidden`), event id when there is one, `request_id`, `reported_actor`, and `created_at`. Create, update, and their audits commit in the same transaction. `reported_actor` is the integration-supplied `X-Integration-Actor` value, not an OS user id.

Staff with the venue admin role can select audit rows. Credential hashes are not granted to staff JWTs. RLS is enabled and forced on the integration tables. The route uses the service role only after the credential, venue, and scope checks; the SQL functions repeat those checks.

## What AI Studio stores

Keep the Google Sheet as a historical export if you still need it. New reads and writes go to this API. Map the portal fields as follows:

| Portal field | API field |
| --- | --- |
| Title | `title` |
| Description | `publicDescription` |
| Private notes | `internalNotes` |
| Start / end | `startDate`, `startTime`, `endDate`, `endTime` in America/Chicago |
| Artist | `GET /artists`, then `artistIds` |
| Artwork | artist artwork upload flow, not an event field |
| Ticket link | `ticketUrl` and `isTicketed` |
| Cover | `coverLabel` |
| Room | `locationLabel` |
| Show on the site | `status: "published"`, `visibility: "public"`, `archived: false` |
| Cancel / unpublish | `status` and `visibility` as in the table above |

Persist `id` and `updatedAt` with the portal's copy of the event. Send `updatedAt` back as `If-Match`. Generate a new idempotency key per logical create, and reuse that same key only to retry that same create.

## Deploy steps

These steps were **not** run for this change.

1. Apply `supabase/migrations/20261103000063_event_integration.sql` to the hosted database after the existing migrations (SQL editor, or `npx supabase db push`). The file does not update existing events.
2. Deploy this Next.js app to Vercel. The routes call the service role from the existing server environment. No new OS env var is required for the integration token.
3. On a trusted machine, with the service-role env loaded, run `node scripts/integration-credential.mjs create --name "HighLevel AI Studio"`.
4. Set `FLOBAMA_OS_API_BASE_URL` and `FLOBAMA_OS_INTEGRATION_TOKEN` on the AI Studio server only.
5. Confirm with a draft, private event, then `GET` it back. Do not use `published` + `public` for the smoke test if the production site should stay unchanged.
6. Confirm `GET /api/public/v1/events` does not list that draft.

## Tests run here

- `npx tsc --noEmit` — passed.
- `npx eslint` on the integration sources, shared event helpers, routes, credential script, and the new test — passed.
- `npx vitest run tests/event-integration-api.test.ts` — 18 passed. Coverage includes missing, unknown, and revoked credentials; scope and cross-venue 404s; overnight Chicago conversion and public-feed eligibility; winter CST conversion; daylight-saving gap and fall-back rejection; idempotent replay versus payload conflict; validation not consuming a key; concurrent duplicate creates; patch omit versus null versus protected fields; stale `If-Match`; cancel, archive, and restore without delete; artist lookup; signed artwork upload; rate limit 429; token redaction; unconfigured 503. The public events route source is unchanged.
- `npx vitest run` — 371 passed, 1 skipped. That includes the existing public listings, timezone, event bulk, artist LED, and auth/validation tests. Two ECAMM suites did not load (`bonjour-service` missing under `clients/local-runner`); they are unrelated and were not edited.
- The integration SQL was not executed against Postgres in this run. The tests use an in-memory store with the same idempotency and conflict rules. Isolated fixture ids were used. Nothing was published to the live site.
- The staff event form was not clicked in a browser. Staff saves now call the same field builder and artist-link helper as this API. No page markup changed.
