# FloBama OS — Build status (milestone 1)

## Completed

- Next.js App Router staff app with TypeScript, Tailwind, shadcn/ui, Lucide
- Design system: dark charcoal sidebar, light workspace, provisional warm-red accent (not official brand)
- Email/password sign-in, logout, password reset request + completion
- Cookie session refresh via Next.js `proxy.ts` + `@supabase/ssr`
- Protected staff routes; access-denied for authenticated non-members
- Venue-scoped roles: admin, manager, viewer (enforced in server actions and RLS)
- Dashboard from live event/artist queries (today overlap, 7-day count, drafts, active artists, needs attention)
- Event manager: list/search/filter/pagination, create, view, edit, duplicate, publish, draft, cancel, archive
- Artist directory: search, create, edit, archive, linked upcoming/past events
- Settings: display name, admin venue rename, read-only timezone and role, logout
- America/Chicago scheduling with timestamptz storage, overnight events, DST rejection
- SQL migration with constraints, indexes, triggers, RLS, least-privilege grants
- Setup-required state when Supabase env vars are missing
- Unit tests for timezone, validation, permissions, redirects
- Optional disposable-environment RLS test (skipped without credentials)

## Explicitly not in this milestone

- Public website, embeddable listings, media, venue screens
- SpotOn sales (status panel only: “Not connected.”)
- Ticketing, inventory, payroll, invitations, multi-venue UI
- Recurring events, spreadsheet import, artwork uploads
- Staff self-registration

## Limitations

- Brand accent is provisional until official tokens exist
- Timezone is not editable in the UI
- Membership/role changes are administrative SQL only
- Live Supabase auth/RLS browser flows were not executed in this environment because project credentials were not provided
- Search filters for events use PostgREST `or` + artist id lists; very large catalogs may need a dedicated search index later

## Next milestone (suggested)

- Limited public event projection (never including internal notes)
- SpotOn connection and event-tied sales
- Media attachments
- Staff invitation flow that still cannot self-promote
