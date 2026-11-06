# SpotOn integration setup runbook

FloBama Music Hall uses SpotOn Restaurant POS. This integration **reads** POS data into FloBama OS for sales reporting, sales during entertainment events, and menu/availability. SpotOn remains the source of truth. Payment processing and POS order mutations are out of scope.

Webhook delivery, reporting access, and menu access are **separate capabilities**. A working webhook does **not** establish access to every sale, payment, refund, or historical order.

## Official documentation (verified)

| Capability | Docs |
| --- | --- |
| Central API intro | https://developers.spoton.com/central-api/docs/getting-started |
| OAuth | https://developers.spoton.com/central-api/docs/spoton-oauth-integration-guide |
| Webhook delivery + signature | https://developers.spoton.com/central-api/reference/webhookevent_delivery-1 |
| Central reporting orders | https://developers.spoton.com/central-api/reference/reportingservice_getorders |
| Central menus | https://developers.spoton.com/central-api/docs/menu-overview |
| Restaurant Export access | https://developers.spoton.com/restaurant/docs/api-access |
| Restaurant Export orders | https://developers.spoton.com/restaurant/docs/orders-1 |

### Production HTTPS bases

- Central API: `https://api.spoton.com`
- Restaurant Export: `https://restaurantapi.spoton.com`
- OAuth authorize: `https://api.spoton.com/oauth2/v1/authorize`
- OAuth token: `https://api.spoton.com/oauth2/v1/token`

### Restaurant Export constraints (do not apply to Central)

- Auth: `x-api-key` header; access is per location
- Max query window: **26 hours**
- `updatedAtEnd` / `createdAtEnd` / `closedAtEnd` must be **≥ 5 minutes in the past**
- Approximate retention: **90 days**
- Recommended near-realtime: every 5 minutes with 5-minute lag; daily 26h reconcile

### Central webhook signature (v1 only)

1. Base64-decode `signature_key` (standard alphabet; padding optional)
2. HMAC-SHA256 over **raw request body bytes** (do not re-serialize JSON)
3. Lowercase hex digest (64 chars)
4. Constant-time compare to `X-Spoton-Webhook-Signature`
5. Require `X-Spoton-Webhook-Signature-Version: v1`

There is **no** unsigned production fallback in FloBama OS.

### Webhook categories documented by Central API

`EVENT_CATEGORY_MENU`, `EVENT_CATEGORY_ITEM`, `EVENT_CATEGORY_MODIFIER`, `EVENT_CATEGORY_ORDER`, `EVENT_CATEGORY_LOCATION_CONNECTION`, `EVENT_CATEGORY_LABOR_TIME_PUNCH`, `EVENT_CATEGORY_FOH`, `EVENT_CATEGORY_ONBOARDING`

This app applies business effects for menu/item updates. Order cancelation webhooks are recorded but **not** treated as a complete sales stream. Full historical sales require Restaurant Export and/or Central Reporting.

**Not invented here:** FloBama OS does not call an undocumented subscription-creation API. Create the subscription in SpotOn’s partner/settings UI (or with SpotOn support) and store the returned `signature_key` in env.

## Credentials (server-only)

Copy from `.env.example`. Never use `NEXT_PUBLIC_*` for secrets.

| Variable | Purpose |
| --- | --- |
| `SPOTON_LOCATION_ID` | Location id used for webhook auth + API paths |
| `SPOTON_WEBHOOK_SIGNATURE_KEY` | Central webhook `signature_key` |
| `SPOTON_RESTAURANT_EXPORT_API_KEY` | Restaurant Export `x-api-key` |
| `SPOTON_RESTAURANT_EXPORT_BASE_URL` | Optional override (default production) |
| `SPOTON_CENTRAL_CLIENT_ID` / `SPOTON_CENTRAL_CLIENT_SECRET` | Central OAuth client |
| `SPOTON_CENTRAL_TOKEN_URL` / `SPOTON_CENTRAL_API_BASE_URL` | Optional overrides |
| `SPOTON_CENTRAL_SCOPES` | Space-separated scopes SpotOn granted the client |

Suggested scopes when SpotOn grants them: `reporting:orders:read menu:all:read business:all:read`.

## Database

Apply migrations in order, including:

`supabase/migrations/20261106000064_spoton_integration.sql`

```bash
npx supabase db push
# or paste SQL files in order in the Supabase SQL editor
```

## Webhook URL

Production origin from `NEXT_PUBLIC_SITE_URL` (default `https://flobama-os.vercel.app`):

```text
https://flobama-os.vercel.app/api/integrations/spoton/webhook
```

Also shown copyable under **Settings → Integrations → SpotOn**.

### Genuine delivery check

1. Set `SPOTON_LOCATION_ID` + `SPOTON_WEBHOOK_SIGNATURE_KEY`
2. Create/subscribe the SpotOn webhook to the URL above for menu/item (and any supported) events
3. Trigger a known menu or 86 change in SpotOn
4. Confirm Settings shows **Last authenticated webhook** and an inbox row
5. Confirm cron/process queue marks the event processed or ignored appropriately
6. Invalid signatures must return **401** (SpotOn should not treat as success)

## Selecting the reporting adapter

In Settings → SpotOn:

- **Restaurant Export API** — typical for RPOS / `client.restaurantpos.spoton.com` merchants with an Export API key
- **Central API** — when partner OAuth + `reporting:orders:read` is granted
- **None** — webhook-only inspection mode (reporting UI stays disabled)

Saving credentials alone does **not** mark the connection verified. Use **Test connection** (documented read-only request).

## Job scheduling (Vercel)

`vercel.json`:

- `/api/cron/led-wall` — every minute (existing)
- `/api/cron/spoton` — every 5 minutes

The SpotOn cron:

1. Processes webhook inbox with leases/retries
2. Runs incremental order sync when sync is enabled and reporting is configured
3. Around **04:00 America/Chicago**, reconciles the last **26 hours** (Export replication lag)
4. Drains queued menu sync jobs

Authorize with `Authorization: Bearer $CRON_SECRET` or Vercel’s `x-vercel-cron: 1`.

## Reporting reconciliation

1. Backfill a known business day from Settings
2. Compare FloBama net sales / taxes / tips / order count to SpotOn BOH reports for the same fiscal/business date
3. Map SpotOn reporting categories to Food / Alcohol / Other / Unmapped (never infer from item names)
4. Re-run the same window — revenue must not increase (idempotent upserts)
5. Confirm gift-card / unreleased scheduled orders are liabilities, not net sales

## Sales during events

- Label: **sales during the event** (not causation, not profit)
- Prefer item timestamps when present
- Configurable pre/post minutes; missing end time is not guessed
- Overlaps are flagged; booking cost `NULL` ≠ `$0`

## Menu / availability

Requires Central `menu:all:read`. Publish only explicitly mapped items when `publish_mapped_menu` is on:

`GET /api/public/v1/menu/items`

Availability `null` / `unknown_or_stale` means unconfirmed — not an inventory ledger.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| 401 on webhook | Signature version, raw body, key Base64, location id mismatch |
| 413 | Payload over 512 KiB |
| Duplicate webhooks | Unique `(provider, location_id, event_id)` — ack 200, no double apply |
| Export 403 | Ask SpotOn to grant the API key for the location |
| Export window errors | ≤26h; end ≥5 minutes ago |
| Central 401/403 | Client credentials, scopes, location onboarded |
| Totals show Unavailable | Reporting not verified (correct — not zero) |
| Public menu empty | Mapping + `publish_public` + `publish_mapped_menu` |

## Still required from SpotOn / venue (account-specific)

1. Confirm whether FloBama’s SpotOn settings webhook is **Central API** delivery (v1 signature) or another product
2. `signature_key` for the production webhook subscription
3. Restaurant Export API key with this location enabled **and/or** Central partner Client ID/Secret with `reporting:orders:read`
4. Central scopes for menus if menu sync is desired (`menu:all:read`)
5. Exact production location id (`SPOTON_LOCATION_ID`)
6. Which event categories to subscribe (menu / item availability / order cancelation, etc.)

Until those are present, adapters are implemented and unit-tested with fixtures, but **not** verified against the live FloBama SpotOn account.
