# FloBama OS

Internal operations platform for FloBama Music Hall. This repository is the staff application for events, artists, and venue settings. It does not modify the public FloBama website, Pick'em, or other production systems.

## Stack

- Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui
- Supabase Postgres + Auth with `@supabase/ssr` cookie sessions
- Zod validation, Luxon for America/Chicago scheduling

## Defaults chosen for this milestone

- Single venue record: FloBama Music Hall (`11111111-1111-4111-8111-111111111111`)
- Timezone locked to `America/Chicago` in the database
- Official FloBama wordmark (`public/flobama-logo.png`) on staff OS, weekly flyers, and vertical kiosk screens. Warm-red `#d36b4a` is the matching accent.
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
   Needed for this app: `20240908000001_init_flobama_os.sql`, `20260908000002_public_listings_and_booth.sql`, `20260908000003_staff_admin.sql`, `20260908000005_screens.sql`, `20260908000006_week_events_slide.sql`, `20260908000007_screen_takeover.sql`, `20260909000008_ticketing.sql`, `20260909000009_master_admin.sql`, `20260909000010_layout_object_types.sql`, and `20260928000011_led_wall.sql`.  

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
| Admin | Create staff, change roles, rename the venue, edit events/artists, screens, ticketing |
| Manager | Edit events/artists, import listings, screens, ticketing. Cannot create staff or rename the venue |
| Viewer | Read-only calendar, artists, staff directory, ticketing sales. Can activate LED wall scenes |

There is still no public registration. The **first** admin is created once:

1. In Supabase **Authentication > Users**, add a user with email and password. Copy the user UUID.
2. Open `supabase/bootstrap_admin.sql`, replace `00000000-0000-0000-0000-000000000000` with that UUID, and run it in the SQL editor.

After that, signed-in admins use **Settings → Staff** to create more logins (email, temporary password, role). People cannot raise their own role. You cannot remove or demote the last admin, or change your own access. `zak@view360.marketing` is the master admin and cannot be removed or demoted by other staff.

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

### Update from the master sheet

Admins and managers use **Events → Update**. That fetches the live published [FloBama master sheet](https://docs.google.com/spreadsheets/d/e/2PACX-1vRENsjXeSHSUIuHU1Fne1ciKu6zW3FzaNxofXOvCUWjSKYaOHZskJupvfG3QHK-AeVfTvZwzN7VaMUk/pubhtml) (CSV), upserts every Published / not Archived row by `legacy_source_id` (`evt_…`), and links artist records. Sheet rows that are unpublished or archived withdraw matching OS events (draft or archive). Re-running does not duplicate. Karaoke titles do not create an artist named Karaoke. `data/legacy-events.csv` is a fallback snapshot if Google is unreachable.

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
2. Add a **Browser Source** at `{origin}/overlay`, width **1920**, height **1080**, for the lower third.
3. For uploaded LED media, add another scene whose **Browser Source** is `{origin}/display/led` at the wall’s pixel size.
4. On the booth PC, install the local client (below). OBS host, port, and password stay in that machine’s config file. They are never stored in git or the database.

This cloud preview cannot reach a booth PC on your LAN. Staff activate scenes in FloBama OS. The booth client pulls the desired scene and calls OBS.

### LED wall client

Admins open **Screens → LED wall** to add scene names or upload an MP4 loop / PNG. **OBS Setup** on that page names the OBS scene that contains the `/display/led` browser source and creates the booth token. Managers and viewers see the enabled list and can activate a scene. Uploaded media plays full-screen from `https://flobama-os.vercel.app/display/led` (playlist JSON: `/api/public/v1/screens/led`). The page polls about once a second, so a second upload can replace the first without refreshing the browser source.

On the sign-in page and in **Settings**, **Download OBS client (.dmg)** is the Mac app. Drag it to Applications and open it. The first launch downloads Node.js and asks for the booth token. If macOS blocks the app, right-click it and choose Open.

To run the same client from a terminal instead:

```bash
cd clients/led-obs
npm install
cp config.example.json led-obs.config.json
# set apiBase, token, and the OBS WebSocket password
node index.mjs
```

`led-obs.config.json` is gitignored. Leave `node index.mjs` running beside OBS. It POSTs to `/api/agent/v1/led-wall/sync` about once a second.

## Screens

Every staff role can open **Screens**. Viewers get the LED wall list. Admins and managers also get vertical screens. Apply `supabase/migrations/20260908000005_screens.sql` (creates `screen_wall_state`, `screen_ads`, and the public `screen-ads` storage bucket). Timed takeovers also need `supabase/migrations/20260908000007_screen_takeover.sql`. LED wall scenes need `supabase/migrations/20260928000011_led_wall.sql`.

### LED wall

Screens has two tabs: **LED wall** and **Vertical screens**. Viewers only see LED wall. Admins preconfigure the scene list. Every staff role can activate one. Apply `supabase/migrations/20260928000011_led_wall.sql` after the screens migration. The older ads/band auto cut is no longer driven from the browser; `screen_wall_state` remains in the database for that earlier migration.

### Vertical TVs

Every 1080×1920 player opens the same page:

`https://flobama-os.vercel.app/display/vertical`

Upload stills or short videos on Screens (50 MB max). Files go straight to the `screen-ads` bucket, then the playlist row is saved. Set order, hold time, and transition (`cut` / `fade` / `slide`). Disabled and archived ads never appear on the TV URL. Playlist JSON: `/api/public/v1/screens/vertical`. Open kiosks poll that API every few seconds and reload `/display/vertical` when the playlist changes.

**This week:** Screens → **Add this week’s events** inserts one live slide. It lists published public shows for the current Sunday–Saturday week in America/Chicago (name, time, artists). Cover charge is not shown. The kiosk refreshes that list from `/api/public/v1/screens/week`. Busy weeks paginate inside the slide. If the hosted enum does not include `week_events` yet, the slide is stored as a dynamic playlist row and still plays correctly.

**Weekly flyer:** Events or Screens → **Print this week’s flyer** opens a US Letter handout at `/print/week`. Use Print and choose Save as PDF. It lists every day of the current Sunday–Saturday week from the same public calendar. Local sample: http://localhost:43123/print/week?demo=1

**Social graphics:** Events, Dashboard, or Screens → **Social sizes** opens `/print/week/social`. Downloads use FloBama’s Live Music This Week look (orange crumpled header, torn paper, blue lineup). Pick Instagram square (1080×1080), Instagram portrait (1080×1350), Story/Reels (1080×1920), or landscape (1920×1080). Busy weeks split across pages. Local sample: http://localhost:43123/print/week/social?demo=1

The player contain-fits the 1080×1920 stage to the TV viewport so ads and the lineup stay on screen. Images and videos use `object-contain` instead of cropping or zooming to fill.

**Takeover Ad Screens:** On the Vertical screens tab, upload an override graphic in that box or pick one from the library. Hold it for 15 minutes, 30 minutes, 1 hour, 2 hours, 4 hours, a custom minute count, or until you clear it. Uploaded overrides stay out of the regular rotation. Open kiosks reload onto that graphic within a few seconds and stay there until the timer ends. Clear now to resume the playlist early.

Local preview of rotation without uploads: http://localhost:43123/display/vertical?demo=1 (development only).

## FloBama Ticketing

Native Event Manager module for general admission, VIP types, whole-table reservations, guest checkout, QR tickets, and door check-in. It is not a separate app.

Apply `supabase/migrations/20260909000008_ticketing.sql` after the earlier migrations. If dividers and restrooms fail to save, also apply `supabase/migrations/20260909000010_layout_object_types.sql` (hosted databases that already have the ticketing enum need that extra `ALTER TYPE`). Until the ticketing SQL is on the hosted database, staff Ticketing screens explain the gap and the public buyer flow still works at `/tickets/demo` (in-memory holds and orders on the running server process).

Staff: **Ticketing** in the sidebar (Dashboard, Ticketed events, Orders, Check-in, Customers, Venue layout, Reports). On an event: **Overview / Ticketing / Table map / Sales**. Enable Ticketing on the event to copy the FloBama main-room layout (Tables 1–28) onto that show only. **Venue layout** is the master room editor: add, move, resize, and label tables, the bar, stage, dance floor, dividers, restrooms, and other spaces. Event table maps keep their own copy and are not rewritten when the master room changes.

Public:

- Event page: `/tickets/[eventId]` — demo: http://localhost:43123/tickets/demo
- Ticket pass: `/t/[token]` (the QR is a random token; door staff resolve it server-side)
- Door: `/ticketing/check-in/[eventId]` (alias `/admin/ticketing/check-in/[eventId]`)

Checkout uses a labeled mock payment adapter. Do not set `STRIPE_SECRET_KEY` until Stripe is wired; V1 will refuse a live Stripe charge rather than pretend.

Holds last 10 minutes. Table inventory uses `UPDATE … WHERE status = 'available'` (and the demo store’s equivalent) so two buyers cannot take the same table.

## GoHighLevel booking

Staff **Booking** (managers and admins) lists **Band Submission** and **Private events** custom objects from GoHighLevel. GHL remains the source of truth; records are not copied into Supabase.

Server-only env (never `NEXT_PUBLIC_`, never git, never Postgres):

- `GHL_PRIVATE_TOKEN` — Private Integration Token
- `GHL_LOCATION_ID`
- Optional `GHL_API_VERSION` (default `2021-07-28`)
- Optional `GHL_OBJECT_BAND_SUBMISSION` / `GHL_OBJECT_PRIVATE_EVENTS` if object labels do not match. Band submissions default to `custom_objects.band_inquiries`.

PIT scopes: custom object schema read, custom object record read and write, associations/relations read, and contacts read. Unset token/location turns the inbox into a setup state, same idea as unset Stripe.

Linked contact name/email/phone come from `GET /associations/relations/{recordId}` then `GET /contacts/{contactId}` — the custom-object record id is never treated as a contact id.

## Band booking fit analysis

Opening a **Band Submission** detail page automatically asks OpenAI for an advisory booking-fit note using only GHL Band Inquiry fields (bio, socials/EPK URLs, draw, compensation, etc.). No live social scraping. The Band submissions list also shows each row’s fit verdict and score.

Server-only: `OPENAI_API_KEY` (optional `OPENAI_MODEL`, default `gpt-4.1-mini`). Unset key shows a setup state on the analysis panel and does not block the rest of the page. Analysis never writes status back to GHL.


