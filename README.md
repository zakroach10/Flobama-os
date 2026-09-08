# FloBama OS

Internal operations platform for FloBama Music Hall. This repository is the staff application for events, artists, and venue settings. It does not modify the public FloBama website, Pick'em, or other production systems.

## Stack

- Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui
- Supabase Postgres + Auth with `@supabase/ssr` cookie sessions
- Zod validation, Luxon for America/Chicago scheduling

## Defaults chosen for this milestone

- Single venue record: FloBama Music Hall (`11111111-1111-4111-8111-111111111111`)
- Timezone locked to `America/Chicago` in the database
- Provisional warm-red accent (not an official brand spec) because no approved logo or tokens were in the repo
- No public signup. The first admin is bootstrapped in SQL; later staff are created in Settings by an admin.
- Event “Publish” plus public visibility feeds the public API, HTML embed, and OBS overlay. The Google Sheet on flobamadowntown.com is not edited from this repo.

## Local setup

### Option A — hosted Supabase project (recommended)

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard). Do not use an existing production database.
2. Copy `.env.example` to `.env.local` and fill:

```bash
cp .env.example .env.local
```

- `NEXT_PUBLIC_SUPABASE_URL` — Project Settings → API → Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Project Settings → API → anon / publishable key
- `SUPABASE_SERVICE_ROLE_KEY` — Project Settings → API → service_role (server only; needed to create staff logins)

3. Apply the schema. SQL editor: paste the files in `supabase/migrations/` in filename order.  
   Needed for this app: `20240908000001_init_flobama_os.sql`, `20260908000002_public_listings_and_booth.sql`, `20260908000003_staff_admin.sql`, and `20260908000005_screens.sql`.  

   Or with the CLI after `npx supabase login` and `npx supabase link --project-ref <ref>`:

```bash
npx supabase db push
```

4. Authentication → URL Configuration:

- Site URL: `https://flobama-os.vercel.app` (keep `http://localhost:43123` in Additional Redirect URLs for local)
- Redirect URLs:
  - `https://flobama-os.vercel.app/auth/callback`
  - `https://flobama-os.vercel.app/auth/callback?next=/reset-password`
  - `https://flobama-os.vercel.app/reset-password`
  - the same paths on `http://localhost:43123`

Enable email/password. The app has no staff signup screen; keep public registration off if the dashboard offers it.

5. Bootstrap the first admin (below), then `npm run dev` and open http://localhost:43123.

### Option B — Docker on your machine

Requires Docker Desktop (or compatible) with enough RAM. This cloud workspace cannot keep the full stack running.

```bash
npm install
npm run supabase:start
npm run supabase:env
npm run dev
```

`supabase:start` applies `supabase/migrations`. Auth redirects are already set in `supabase/config.toml` for port 43123. Studio is at http://127.0.0.1:54323. Create the first user there, then run the admin SQL.

## Staff roles and admin bootstrap

| Role | What they can do |
| --- | --- |
| Admin | Create staff, change roles, rename the venue, edit events/artists, booth, screens |
| Manager | Edit events/artists, import listings, booth, screens. Cannot create staff or rename the venue |
| Viewer | Read-only calendar, artists, and staff directory |

There is still no public registration. The **first** admin is created once:

1. In Supabase **Authentication > Users**, add a user with email and password. Copy the user UUID.
2. Open `supabase/bootstrap_admin.sql`, replace `00000000-0000-0000-0000-000000000000` with that UUID, and run it in the SQL editor.

After that, signed-in admins use **Settings → Staff** to create more logins (email, temporary password, role). People cannot raise their own role. You cannot remove or demote the last admin, or change your own access.

Creating a login needs `SUPABASE_SERVICE_ROLE_KEY` on the server. Role changes and removals use the signed-in admin session and RLS.

## Scripts

```bash
npm run dev              # http://localhost:43123
npm run supabase:start  # local Docker stack
npm run supabase:env    # write .env.local from that stack
npm run supabase:stop
npm run build
npm run start
npm run lint
npm run typecheck
npm run test
```

Database security tests that talk to Postgres are skipped unless you set `RLS_TEST_ENABLED=1` plus service-role credentials against a **disposable** project.

## Vercel

Public app: [https://flobama-os.vercel.app](https://flobama-os.vercel.app)

Set `NEXT_PUBLIC_SITE_URL=https://flobama-os.vercel.app` (no trailing slash required) plus the Supabase keys. Redeploy after Auth redirect URLs include that origin. Embed and overlay routes send `Content-Security-Policy: frame-ancestors *` so WordPress can iframe them.

## Public listings

Anonymous clients cannot `SELECT` `public.events`. They only read `event_listings` and `event_listing_artists` (published + public + not archived). Internal notes never appear there.

### Import the legacy sheet

`data/legacy-events.csv` is the saved FloBama master sheet (68 rows). Admins and managers use **Events → Import legacy sheet**. That imports the **41** rows where Published is Yes and Archived is not Yes, upserts by `legacy_source_id` (`evt_…`), and links artist records. Re-running does not duplicate. Karaoke titles do not create an artist named Karaoke.

### JSON API (CORS `*` on GET)

- `GET /api/public/v1/events` — upcoming by default; `from`, `to`, `limit`
- `GET /api/public/v1/events/[id]`
- `GET /api/public/v1/now` — today’s overlapping public events plus booth now-playing if that event is public

Each event includes `name`, `day`, `date`, `time` (America/Chicago), `ticketed`, `ticketUrl`, `coverCharge`, and ISO instants.

### Website embed

Settings has a copy-paste snippet. After deploy, WordPress / Elementor can iframe this app instead of fetching the Google Sheet:

```html
<iframe src="https://flobama-os.vercel.app/embed/events" title="FloBama events" style="width:100%;min-height:640px;border:0"></iframe>
<script src="https://flobama-os.vercel.app/embed/events.js" defer></script>
```

JSON: `https://flobama-os.vercel.app/api/public/v1/events`  
OBS overlay: `https://flobama-os.vercel.app/overlay`

This repository does not change flobamadowntown.com.

## OBS booth (LAN)

1. In OBS: **Tools → WebSocket Server Settings**. Enable the v5 server. Note host (usually `127.0.0.1`), port (`4455`), and password.
2. Add a **Browser Source** at `{origin}/overlay`, width **1920**, height **1080**.
3. Sign in to FloBama OS on the booth PC as admin or manager. Open **Booth**.
4. Connect OBS from that page. Host, port, and password stay in `sessionStorage` on that machine — they are never stored in git or the database.
5. Set **now playing** and toggle the lower third. The overlay only reveals events that qualify for `event_listings`.

This cloud preview cannot reach a booth PC on your LAN. Viewers can see the overlay and API; they cannot write `booth_state` or use OBS controls.

## Screens

Admin and manager: **Screens**. Apply `supabase/migrations/20260908000005_screens.sql` (creates `screen_wall_state`, `screen_ads`, and the public `screen-ads` storage bucket).

### LED wall

OBS scenes stay prebuilt (ads loop vs band logo). On the booth PC, open Screens, connect OBS (same `sessionStorage` host/port/password as Booth), pick the Ads and Band scene names, and save Auto. The page cuts to Band when `/api/public/v1/now` reports now-playing or an overlapping public event; otherwise Ads. Manual mode cuts to a chosen scene.

### Vertical TVs

Every 1080×1920 player opens the same page:

`https://flobama-os.vercel.app/display/vertical`

Upload stills or short videos on Screens. Set order, hold time, and transition (`cut` / `fade` / `slide`). Disabled and archived ads never appear on the TV URL. Playlist JSON: `/api/public/v1/screens/vertical`.
