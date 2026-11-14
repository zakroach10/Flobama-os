-- Customer app: public menu, merch catalog, orders, and stream recordings.
-- Additive only. Does not alter events, artists, LED wall, trivia, or production tables.
-- Apply on a disposable database first. This change does not run against production.

-- ---------------------------------------------------------------------------
-- Staff menus: Customer app
-- ---------------------------------------------------------------------------
alter table public.venue_memberships
  drop constraint if exists venue_memberships_menus_known;

update public.venue_memberships
set menus = menus || array['customer']::text[]
where menus is not null
  and not ('customer' = any (menus))
  and role in ('admin', 'manager');

alter table public.venue_memberships
  add constraint venue_memberships_menus_known check (
    menus is null
    or menus <@ array[
      'dashboard',
      'programming',
      'booking',
      'social',
      'audience',
      'screens',
      'cameras',
      'production',
      'ticketing',
      'spoton',
      'artists',
      'settings',
      'server',
      'customer'
    ]::text[]
  );

-- ---------------------------------------------------------------------------
-- Full food and drink menu. menu_specials stay the screen promos.
-- ---------------------------------------------------------------------------
create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  category text not null check (char_length(btrim(category)) between 1 and 80),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  description text check (description is null or char_length(description) <= 500),
  price_label text not null check (char_length(btrim(price_label)) between 1 and 40),
  sort_order integer not null default 0 check (sort_order >= 0),
  available boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists menu_items_venue_idx
  on public.menu_items (venue_id, category, sort_order)
  where archived_at is null;

drop trigger if exists menu_items_set_updated_at on public.menu_items;
create trigger menu_items_set_updated_at
  before update on public.menu_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Merch catalog and orders. Prices are integer cents. Stripe ids are server-only.
-- ---------------------------------------------------------------------------
create table if not exists public.merch_products (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  description text check (description is null or char_length(description) <= 800),
  price_cents integer not null check (price_cents between 50 and 100000),
  currency text not null default 'usd' check (currency = 'usd'),
  image_url text check (image_url is null or char_length(image_url) <= 800),
  sku text check (sku is null or char_length(sku) <= 40),
  active boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists merch_products_venue_idx
  on public.merch_products (venue_id, sort_order)
  where archived_at is null;

drop trigger if exists merch_products_set_updated_at on public.merch_products;
create trigger merch_products_set_updated_at
  before update on public.merch_products
  for each row execute function public.set_updated_at();

create table if not exists public.merch_orders (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'paid', 'fulfilled', 'cancelled', 'refunded')),
  customer_email text not null check (char_length(customer_email) between 3 and 200),
  customer_name text check (customer_name is null or char_length(customer_name) <= 120),
  total_cents integer not null check (total_cents > 0),
  currency text not null default 'usd' check (currency = 'usd'),
  access_token text not null check (char_length(access_token) between 16 and 128),
  checkout_mode text not null check (checkout_mode in ('test', 'stripe')),
  checkout_url text check (checkout_url is null or char_length(checkout_url) <= 1000),
  stripe_checkout_session_id text check (stripe_checkout_session_id is null or char_length(stripe_checkout_session_id) <= 120),
  stripe_payment_intent_id text check (stripe_payment_intent_id is null or char_length(stripe_payment_intent_id) <= 120),
  idempotency_key text check (idempotency_key is null or char_length(idempotency_key) between 8 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists merch_orders_stripe_session_idx
  on public.merch_orders (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists merch_orders_idempotency_idx
  on public.merch_orders (venue_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists merch_orders_venue_created_idx
  on public.merch_orders (venue_id, created_at desc);

drop trigger if exists merch_orders_set_updated_at on public.merch_orders;
create trigger merch_orders_set_updated_at
  before update on public.merch_orders
  for each row execute function public.set_updated_at();

create table if not exists public.merch_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.merch_orders (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  product_id uuid references public.merch_products (id) on delete set null,
  name_snapshot text not null check (char_length(name_snapshot) between 1 and 160),
  quantity integer not null check (quantity between 1 and 8),
  unit_price_cents integer not null check (unit_price_cents > 0),
  created_at timestamptz not null default now()
);

create index if not exists merch_order_items_order_idx
  on public.merch_order_items (order_id);

-- ---------------------------------------------------------------------------
-- Past performances published to the customer app (Mux playback ids).
-- ---------------------------------------------------------------------------
create table if not exists public.customer_recordings (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  provider text not null default 'mux' check (provider = 'mux'),
  provider_asset_id text check (provider_asset_id is null or char_length(provider_asset_id) <= 120),
  playback_id text check (playback_id is null or char_length(playback_id) between 8 and 120),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text check (description is null or char_length(description) <= 800),
  event_id uuid references public.events (id) on delete set null,
  artist_id uuid references public.artists (id) on delete set null,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  thumbnail_url text check (thumbnail_url is null or char_length(thumbnail_url) <= 800),
  recorded_at timestamptz,
  published boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_recordings_venue_idx
  on public.customer_recordings (venue_id, recorded_at desc nulls last)
  where archived_at is null;

create unique index if not exists customer_recordings_asset_idx
  on public.customer_recordings (venue_id, provider_asset_id)
  where provider_asset_id is not null;

drop trigger if exists customer_recordings_set_updated_at on public.customer_recordings;
create trigger customer_recordings_set_updated_at
  before update on public.customer_recordings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Public projections. security_invoker = false matches event_listings:
-- anon reads the view, never the base tables, and never internal columns.
-- ---------------------------------------------------------------------------
create or replace view public.customer_event_listings
with (security_invoker = false)
as
select
  e.id,
  e.venue_id,
  e.title,
  e.public_description,
  e.event_type,
  e.starts_at,
  e.ends_at,
  e.location_label,
  e.featured,
  e.is_ticketed,
  e.ticket_url,
  e.cover_label
from public.events e
where e.status = 'published'
  and e.visibility = 'public'
  and e.archived_at is null;

create or replace view public.customer_event_artists
with (security_invoker = false)
as
select
  ea.event_id,
  ea.venue_id,
  ea.display_order,
  ea.artist_id,
  a.name,
  a.genre
from public.event_artists ea
join public.artists a on a.id = ea.artist_id
join public.events e on e.id = ea.event_id
where e.status = 'published'
  and e.visibility = 'public'
  and e.archived_at is null
  and a.archived_at is null;

create or replace view public.customer_artist_listings
with (security_invoker = false)
as
select
  a.id,
  a.venue_id,
  a.name,
  a.genre,
  a.bio,
  a.website_url
from public.artists a
where a.archived_at is null;

create or replace view public.customer_menu_special_listings
with (security_invoker = false)
as
select
  s.id,
  s.venue_id,
  s.title,
  s.subtitle,
  s.category::text as category,
  s.price_label,
  s.public_url as image_url
from public.menu_specials s
where s.enabled = true
  and s.archived_at is null
  and (s.starts_at is null or s.starts_at <= now())
  and (s.ends_at is null or s.ends_at > now());

create or replace view public.customer_menu_item_listings
with (security_invoker = false)
as
select
  m.id,
  m.venue_id,
  m.category,
  m.name,
  m.description,
  m.price_label,
  m.sort_order
from public.menu_items m
where m.available = true
  and m.archived_at is null;

create or replace view public.customer_merch_listings
with (security_invoker = false)
as
select
  p.id,
  p.venue_id,
  p.name,
  p.description,
  p.price_cents,
  p.currency,
  p.image_url,
  p.sku,
  p.sort_order
from public.merch_products p
where p.active = true
  and p.archived_at is null;

create or replace view public.customer_recording_listings
with (security_invoker = false)
as
select
  r.id,
  r.venue_id,
  r.provider,
  r.playback_id,
  r.title,
  r.description,
  r.duration_seconds,
  r.thumbnail_url,
  r.recorded_at,
  r.event_id,
  case
    when e.id is not null then e.title
    else null
  end as event_title,
  r.artist_id,
  a.name as artist_name
from public.customer_recordings r
left join public.events e
  on e.id = r.event_id
  and e.status = 'published'
  and e.visibility = 'public'
  and e.archived_at is null
left join public.artists a
  on a.id = r.artist_id
  and a.archived_at is null
where r.published = true
  and r.archived_at is null
  and r.playback_id is not null;

-- ---------------------------------------------------------------------------
-- RLS. Anon has no table access. Orders are inserted by the server role only.
-- ---------------------------------------------------------------------------
alter table public.menu_items enable row level security;
alter table public.menu_items force row level security;
alter table public.merch_products enable row level security;
alter table public.merch_products force row level security;
alter table public.merch_orders enable row level security;
alter table public.merch_orders force row level security;
alter table public.merch_order_items enable row level security;
alter table public.merch_order_items force row level security;
alter table public.customer_recordings enable row level security;
alter table public.customer_recordings force row level security;

revoke all on public.menu_items from anon, public, authenticated;
revoke all on public.merch_products from anon, public, authenticated;
revoke all on public.merch_orders from anon, public, authenticated;
revoke all on public.merch_order_items from anon, public, authenticated;
revoke all on public.customer_recordings from anon, public, authenticated;

grant select, insert, update on public.menu_items to authenticated;
grant select, insert, update on public.merch_products to authenticated;
grant select, update on public.merch_orders to authenticated;
grant select on public.merch_order_items to authenticated;
grant select, insert, update on public.customer_recordings to authenticated;

revoke all on public.customer_event_listings from anon, public, authenticated;
revoke all on public.customer_event_artists from anon, public, authenticated;
revoke all on public.customer_artist_listings from anon, public, authenticated;
revoke all on public.customer_menu_special_listings from anon, public, authenticated;
revoke all on public.customer_menu_item_listings from anon, public, authenticated;
revoke all on public.customer_merch_listings from anon, public, authenticated;
revoke all on public.customer_recording_listings from anon, public, authenticated;

grant select on public.customer_event_listings to anon, authenticated;
grant select on public.customer_event_artists to anon, authenticated;
grant select on public.customer_artist_listings to anon, authenticated;
grant select on public.customer_menu_special_listings to anon, authenticated;
grant select on public.customer_menu_item_listings to anon, authenticated;
grant select on public.customer_merch_listings to anon, authenticated;
grant select on public.customer_recording_listings to anon, authenticated;

drop policy if exists menu_items_select_member on public.menu_items;
create policy menu_items_select_member
  on public.menu_items for select to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists menu_items_insert_managers on public.menu_items;
create policy menu_items_insert_managers
  on public.menu_items for insert to authenticated
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

drop policy if exists menu_items_update_managers on public.menu_items;
create policy menu_items_update_managers
  on public.menu_items for update to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

drop policy if exists merch_products_select_member on public.merch_products;
create policy merch_products_select_member
  on public.merch_products for select to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists merch_products_insert_managers on public.merch_products;
create policy merch_products_insert_managers
  on public.merch_products for insert to authenticated
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

drop policy if exists merch_products_update_managers on public.merch_products;
create policy merch_products_update_managers
  on public.merch_products for update to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

drop policy if exists merch_orders_select_member on public.merch_orders;
create policy merch_orders_select_member
  on public.merch_orders for select to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists merch_orders_update_managers on public.merch_orders;
create policy merch_orders_update_managers
  on public.merch_orders for update to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

drop policy if exists merch_order_items_select_member on public.merch_order_items;
create policy merch_order_items_select_member
  on public.merch_order_items for select to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists customer_recordings_select_member on public.customer_recordings;
create policy customer_recordings_select_member
  on public.customer_recordings for select to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists customer_recordings_insert_managers on public.customer_recordings;
create policy customer_recordings_insert_managers
  on public.customer_recordings for insert to authenticated
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

drop policy if exists customer_recordings_update_managers on public.customer_recordings;
create policy customer_recordings_update_managers
  on public.customer_recordings for update to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

-- Starter menu and merch. Staff can edit or archive these after the migration is applied.
insert into public.menu_items (id, venue_id, category, name, description, price_label, sort_order)
values
  ('22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111111', 'Starters & Wings', 'FloBama Wings', 'Crispy wings tossed in house sauce.', '$14', 10),
  ('22222222-2222-4222-8222-222222222202', '11111111-1111-4111-8111-111111111111', 'Starters & Wings', 'Loaded Fries', 'Fries with queso, bacon, and green onion.', '$9', 20),
  ('22222222-2222-4222-8222-222222222203', '11111111-1111-4111-8111-111111111111', 'Starters & Wings', 'Nachos', 'Shareable nachos with queso and jalapeños.', '$11', 30),
  ('22222222-2222-4222-8222-222222222204', '11111111-1111-4111-8111-111111111111', 'Smoked Meats', 'Pulled Pork Plate', 'Slow-smoked pulled pork with two sides.', '$16', 10),
  ('22222222-2222-4222-8222-222222222205', '11111111-1111-4111-8111-111111111111', 'Smoked Meats', 'Rib Plate', 'Dry-rubbed ribs with two sides.', '$22', 20),
  ('22222222-2222-4222-8222-222222222206', '11111111-1111-4111-8111-111111111111', 'Smoked Meats', 'Brisket Plate', 'Sliced brisket with two sides.', '$18', 30),
  ('22222222-2222-4222-8222-222222222207', '11111111-1111-4111-8111-111111111111', 'Burgers & Sandwiches', 'FloBama Burger', 'Hand-pressed burger with American cheese.', '$14', 10),
  ('22222222-2222-4222-8222-222222222208', '11111111-1111-4111-8111-111111111111', 'Burgers & Sandwiches', 'Brisket Sandwich', 'Smoked brisket on a toasted bun.', '$15', 20),
  ('22222222-2222-4222-8222-222222222209', '11111111-1111-4111-8111-111111111111', 'Drinks', 'Draft Beer', 'Ask the bar for what is on tap.', '$6', 10),
  ('22222222-2222-4222-8222-222222222210', '11111111-1111-4111-8111-111111111111', 'Drinks', 'Sweet Tea', 'House sweet tea.', '$3', 20)
on conflict (id) do nothing;

insert into public.merch_products (id, venue_id, name, description, price_cents, sku, sort_order)
values
  ('33333333-3333-4333-8333-333333333301', '11111111-1111-4111-8111-111111111111', 'FloBama Tee', 'Black tee with the FloBama wordmark. Ask the bar for sizes.', 2800, 'TEE', 10),
  ('33333333-3333-4333-8333-333333333302', '11111111-1111-4111-8111-111111111111', 'FloBama Hat', 'Embroidered hat. Pickup at the bar.', 2400, 'HAT', 20),
  ('33333333-3333-4333-8333-333333333303', '11111111-1111-4111-8111-111111111111', 'FloBama Koozie', 'Keeps a cold one cold through the set.', 600, 'KOOZIE', 30)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
