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
- No staff self-signup; memberships are assigned with SQL
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

3. Apply the schema. SQL editor: paste both files in order — `supabase/migrations/20240908000001_init_flobama_os.sql` then `supabase/migrations/20260908000002_public_listings_and_booth.sql`.  
   Or with the CLI after `npx supabase login` and `npx supabase link --project-ref <ref>`:

```bash
npx supabase db push
```

4. Authentication → URL Configuration:

- Site URL: `http://localhost:43123` (production: your Vercel origin)
- Redirect URLs:
  - `http://localhost:43123/auth/callback`
  - `http://localhost:43123/auth/callback?next=/reset-password`
  - `http://localhost:43123/reset-password`
  - the same paths on the production origin

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

## Initial admin bootstrap

There is no “make me admin” screen.

1. In Supabase **Authentication > Users**, add a user with email and password. Copy the user UUID.
2. Open `supabase/bootstrap_admin.sql`, replace `00000000-0000-0000-0000-000000000000` with that UUID, and run it in the SQL editor.

That inserts an `admin` row into `venue_memberships` for FloBama Music Hall.

To add a manager or viewer later, run the same insert with `role` set to `manager` or `viewer`.

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

Set the same public env vars in the Vercel project. Redeploy after Auth redirect URLs include the production origin.

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
<iframe src="https://<app-origin>/embed/events" title="FloBama events" style="width:100%;min-height:640px;border:0"></iframe>
<script src="https://<app-origin>/embed/events.js" defer></script>
```

This repository does not change flobamadowntown.com.

## OBS booth (LAN)

1. In OBS: **Tools → WebSocket Server Settings**. Enable the v5 server. Note host (usually `127.0.0.1`), port (`4455`), and password.
2. Add a **Browser Source** at `{origin}/overlay`, width **1920**, height **1080**.
3. Sign in to FloBama OS on the booth PC as admin or manager. Open **Booth**.
4. Connect OBS from that page. Host, port, and password stay in `sessionStorage` on that machine — they are never stored in git or the database.
5. Set **now playing** and toggle the lower third. The overlay only reveals events that qualify for `event_listings`.

This cloud preview cannot reach a booth PC on your LAN. Viewers can see the overlay and API; they cannot write `booth_state` or use OBS controls.
