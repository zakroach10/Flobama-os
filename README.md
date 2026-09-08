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

1. Create a Supabase project. Do not use production if you are experimenting.
2. Copy environment variables:

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

3. Apply the migration. In the Supabase SQL editor, paste and run:

`supabase/migrations/20240908000001_init_flobama_os.sql`

Or, if you use the Supabase CLI:

```bash
npx supabase db push
```

4. Configure Auth URL allow-lists in Supabase **Authentication > URL Configuration**:

- Site URL: `http://localhost:43123` (local) or your Vercel URL
- Redirect URLs:
  - `http://localhost:43123/auth/callback`
  - `http://localhost:43123/auth/callback?next=/reset-password`
  - `http://localhost:43123/reset-password`
  - matching `https://<your-domain>/auth/callback` and reset-password URLs in production

Enable email/password. Disable public sign-ups if the dashboard option is available (Confirm email can stay on).

5. Bootstrap the first admin (see below).
6. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:43123](http://localhost:43123).

## Initial admin bootstrap

There is no “make me admin” screen.

1. In Supabase **Authentication > Users**, add a user with email and password. Copy the user UUID.
2. Open `supabase/bootstrap_admin.sql`, replace `00000000-0000-0000-0000-000000000000` with that UUID, and run it in the SQL editor.

That inserts an `admin` row into `venue_memberships` for FloBama Music Hall.

To add a manager or viewer later, run the same insert with `role` set to `manager` or `viewer`.

## Scripts

```bash
npm run dev        # http://localhost:43123
npm run build
npm run start
npm run lint
npm run typecheck
npm run test
```

Database security tests that talk to Postgres are skipped unless you set `RLS_TEST_ENABLED=1` plus service-role credentials against a **disposable** project.

## Vercel

Set the same public env vars in the Vercel project. Redeploy after Auth redirect URLs include the production origin.
