# FloBama OS — Build status

## Completed

- Next.js App Router staff app with TypeScript, Tailwind, shadcn/ui, Lucide
- Design system: dark charcoal sidebar, light workspace, provisional warm-red accent (not official brand)
- Email/password sign-in, logout, password reset request + completion
- Cookie session refresh via Next.js `proxy.ts` + `@supabase/ssr`
- Protected staff routes; access-denied for authenticated non-members
- Venue-scoped roles: admin, manager, viewer (enforced in server actions and RLS)
- Dashboard from live event/artist queries (today overlap, 7-day count, drafts, active artists, needs attention)
- Event manager: list/search/filter/pagination, create, view, edit, duplicate, publish, draft, cancel, archive
- Ticketed / ticket URL / cover fields on the staff event form
- Artist directory: search, create, edit, archive, linked upcoming/past events
- Settings: display name, admin venue rename, website embed snippet, public API URL
- Role-based permissions with a visible matrix (admin / manager / viewer)
- Admin staff directory: create logins, change roles, remove access (no self-promote, last admin protected)
- America/Chicago scheduling with timestamptz storage, overnight events, DST rejection
- SQL migrations with constraints, indexes, triggers, RLS, least-privilege grants
- Public projection views (`event_listings`, `event_listing_artists`) — anon has no `SELECT` on `events`
- Events → Update syncs published, unarchived rows from the live FloBama master sheet (idempotent `legacy_source_id`)
- Public JSON API: `/api/public/v1/events`, `/events/[id]`, `/now`
- Public HTML embed at `/embed/events` plus iframe resizer `/embed/events.js`
- OBS overlay at `/overlay` (1920×1080 browser source) and LED wall scene list on Screens. A booth client (`clients/led-obs`) polls `/api/agent/v1/led-wall/sync` and cuts OBS. The sign-in page downloads `FloBama-LED-OBS-1.0.2.dmg`. Admins configure scenes and MP4/PNG uploads; every staff role can activate. Uploads play at `/display/led`
- Screens: LED wall OBS scene mapping (auto ads vs band), shared vertical 1080×1920 ad rotation, a live “this week” events slide, timed takeovers, and a US Letter weekly flyer at `/print/week`
- Trivia: staff-activated Shoals music history game with QR join on the LED wall, temp patron names, automatic rounds/top-3 teases/final board, vertical kiosk join promo, and CSV question pack upload
- Setup-required state when Supabase env vars are missing
- Unit tests for timezone, validation, permissions, redirects, CSV parser, public-field filter, OBS helpers
- Optional disposable-environment RLS test (skipped without credentials)

## Explicitly not in this milestone

- Editing flobamadowntown.com, Pick'em, or other production sites
- SpotOn / sales reporting
- Inventory, payroll, invitations, multi-venue UI
- Recurring events, per-TV playlists, artist logo columns
- Public staff self-registration (admins create accounts; there is still no signup page)
- A live OBS booth in this cloud environment (LAN-only)

## Limitations

- Brand accent is provisional until official tokens exist
- Timezone is not editable in the UI
- The first admin is still bootstrapped with SQL; later staff are created in Settings
- Public origin is `https://flobama-os.vercel.app` (`NEXT_PUBLIC_SITE_URL`); embed/overlay allow iframe embedding
- Hosted Supabase must apply `20260908000002_public_listings_and_booth.sql`, `20260908000003_staff_admin.sql`, `20260908000005_screens.sql`, `20260908000006_week_events_slide.sql`, `20260908000007_screen_takeover.sql`, `20260928000011_led_wall.sql`, and `20260929000012_trivia.sql`
- Creating logins requires `SUPABASE_SERVICE_ROLE_KEY` on the server only
- Search filters for events use PostgREST `or` + artist id lists; very large catalogs may need a dedicated search index later

## Apply after pull

Run the new migrations on the hosted project (SQL editor or `npx supabase db push`). For staff creation, add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`. Then use **Settings → Staff** as an admin, **Events → Update** as an admin or manager, and **Screens** after the screens migration.
