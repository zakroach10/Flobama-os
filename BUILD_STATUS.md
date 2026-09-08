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
- America/Chicago scheduling with timestamptz storage, overnight events, DST rejection
- SQL migrations with constraints, indexes, triggers, RLS, least-privilege grants
- Public projection views (`event_listings`, `event_listing_artists`) — anon has no `SELECT` on `events`
- Legacy sheet import of 41 published, unarchived rows (idempotent `legacy_source_id`)
- Public JSON API: `/api/public/v1/events`, `/events/[id]`, `/now`
- Public HTML embed at `/embed/events` plus iframe resizer `/embed/events.js`
- OBS overlay at `/overlay` (1920×1080 browser source) and staff `/booth` (obs-websocket v5, sessionStorage credentials)
- Setup-required state when Supabase env vars are missing
- Unit tests for timezone, validation, permissions, redirects, CSV parser, public-field filter, OBS helpers
- Optional disposable-environment RLS test (skipped without credentials)

## Explicitly not in this milestone

- Editing flobamadowntown.com, Pick'em, or other production sites
- SpotOn sales (status panel only: “Not connected.”)
- Inventory, payroll, invitations, multi-venue UI
- Recurring events, artwork uploads
- Staff self-registration
- A live OBS booth in this cloud environment (LAN-only)

## Limitations

- Brand accent is provisional until official tokens exist
- Timezone is not editable in the UI
- Membership/role changes are administrative SQL only
- Hosted Supabase must apply `20260908000002_public_listings_and_booth.sql` before import, API, embed, and booth writes work
- Search filters for events use PostgREST `or` + artist id lists; very large catalogs may need a dedicated search index later

## Apply after pull

Run the new migration on the hosted project (SQL editor or `npx supabase db push`), then use **Events → Import legacy sheet** while signed in as admin or manager.
