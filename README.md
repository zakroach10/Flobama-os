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
- Event “Publish” only updates `events.status`; website distribution is not connected

## Local setup

### Option A — hosted Supabase project (recommended)

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard). Do not use an existing production database.
2. Copy `.env.example` to `.env.local` and fill:

```bash
cp .env.example .env.local
```

- `NEXT_PUBLIC_SUPABASE_URL` — Project Settings → API → Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Project Settings → API → anon / publishable key

3. Apply the schema. SQL editor: paste `supabase/migrations/20240908000001_init_flobama_os.sql`.  
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
