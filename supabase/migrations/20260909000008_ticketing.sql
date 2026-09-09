-- FloBama Ticketing: event-linked tickets, whole-table reservations, holds, orders, QR, check-in.
-- Anonymous role cannot read orders, tickets, payments, or customer PII.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'layout_object_type') then
    create type public.layout_object_type as enum (
      'table', 'booth', 'bar', 'stage', 'dance_floor', 'standing', 'vip_area', 'entrance', 'label', 'decor'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'layout_shape') then
    create type public.layout_shape as enum ('rect', 'round', 'ellipse');
  end if;
  if not exists (select 1 from pg_type where typname = 'table_inventory_status') then
    create type public.table_inventory_status as enum (
      'available', 'held', 'sold', 'blocked', 'comp', 'unavailable'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'ticket_type_kind') then
    create type public.ticket_type_kind as enum ('ga', 'vip', 'other');
  end if;
  if not exists (select 1 from pg_type where typname = 'ticket_visibility') then
    create type public.ticket_visibility as enum ('public', 'hidden');
  end if;
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type public.order_status as enum ('pending', 'paid', 'cancelled', 'refunded', 'partially_refunded');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded');
  end if;
  if not exists (select 1 from pg_type where typname = 'ticket_status') then
    create type public.ticket_status as enum ('valid', 'checked_in', 'void', 'refunded');
  end if;
  if not exists (select 1 from pg_type where typname = 'order_item_kind') then
    create type public.order_item_kind as enum ('ticket', 'table', 'comp');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_provider') then
    create type public.payment_provider as enum ('mock', 'stripe', 'manual');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Master venue layout
-- ---------------------------------------------------------------------------

create table if not exists public.venue_layouts (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  is_default boolean not null default false,
  canvas_width integer not null default 1200 check (canvas_width between 400 and 4000),
  canvas_height integer not null default 860 check (canvas_height between 400 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists venue_layouts_default_idx
  on public.venue_layouts (venue_id)
  where is_default = true;

create table if not exists public.venue_layout_objects (
  id uuid primary key default gen_random_uuid(),
  layout_id uuid not null references public.venue_layouts (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  object_type public.layout_object_type not null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  capacity integer not null default 0 check (capacity between 0 and 200),
  x_position double precision not null default 0,
  y_position double precision not null default 0,
  width double precision not null default 80 check (width between 8 and 2000),
  height double precision not null default 80 check (height between 8 and 2000),
  rotation double precision not null default 0,
  shape public.layout_shape not null default 'rect',
  table_number text check (table_number is null or char_length(table_number) <= 40),
  section text check (section is null or char_length(section) <= 80),
  default_price_cents integer check (default_price_cents is null or default_price_cents >= 0),
  sellable boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists venue_layout_objects_layout_idx
  on public.venue_layout_objects (layout_id, sort_order);

-- ---------------------------------------------------------------------------
-- Event ticketing settings + ticket types
-- ---------------------------------------------------------------------------

create table if not exists public.event_ticketing (
  event_id uuid primary key references public.events (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  enabled boolean not null default false,
  doors_at timestamptz,
  capacity integer check (capacity is null or capacity between 1 and 20000),
  sales_start timestamptz,
  sales_end timestamptz,
  max_tickets_per_order integer not null default 8 check (max_tickets_per_order between 1 and 50),
  hold_minutes integer not null default 10 check (hold_minutes between 2 and 30),
  tables_enabled boolean not null default true,
  refunds_enabled boolean not null default false,
  refund_policy text check (refund_policy is null or char_length(refund_policy) <= 4000),
  age_restriction text check (age_restriction is null or char_length(age_restriction) <= 120),
  parking_notes text check (parking_notes is null or char_length(parking_notes) <= 2000),
  venue_notes text check (venue_notes is null or char_length(venue_notes) <= 4000),
  source_layout_id uuid references public.venue_layouts (id) on delete set null,
  fee_bps integer not null default 0 check (fee_bps between 0 and 2000),
  tax_bps integer not null default 0 check (tax_bps between 0 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_ticketing_venue_enabled_idx
  on public.event_ticketing (venue_id)
  where enabled = true;

create table if not exists public.ticket_types (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  kind public.ticket_type_kind not null default 'ga',
  price_cents integer not null default 0 check (price_cents >= 0),
  quantity integer not null default 0 check (quantity between 0 and 20000),
  blocked_quantity integer not null default 0 check (blocked_quantity >= 0),
  max_per_order integer not null default 8 check (max_per_order between 1 and 50),
  sales_start timestamptz,
  sales_end timestamptz,
  active boolean not null default true,
  visibility public.ticket_visibility not null default 'public',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticket_types_blocked_lte_qty check (blocked_quantity <= quantity)
);

create index if not exists ticket_types_event_idx
  on public.ticket_types (event_id, sort_order);

-- ---------------------------------------------------------------------------
-- Event-specific layout snapshot
-- ---------------------------------------------------------------------------

create table if not exists public.event_layouts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  source_layout_id uuid references public.venue_layouts (id) on delete set null,
  canvas_width integer not null default 1200,
  canvas_height integer not null default 860,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_layout_objects (
  id uuid primary key default gen_random_uuid(),
  event_layout_id uuid not null references public.event_layouts (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  source_object_id uuid,
  object_type public.layout_object_type not null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  capacity integer not null default 0 check (capacity between 0 and 200),
  x_position double precision not null default 0,
  y_position double precision not null default 0,
  width double precision not null default 80,
  height double precision not null default 80,
  rotation double precision not null default 0,
  shape public.layout_shape not null default 'rect',
  table_number text check (table_number is null or char_length(table_number) <= 40),
  section text check (section is null or char_length(section) <= 80),
  price_cents integer check (price_cents is null or price_cents >= 0),
  sellable boolean not null default false,
  vip boolean not null default false,
  status public.table_inventory_status not null default 'unavailable',
  hold_session text,
  hold_until timestamptz,
  sold_order_id uuid,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_layout_objects_event_idx
  on public.event_layout_objects (event_id, sort_order);
create index if not exists event_layout_objects_hold_idx
  on public.event_layout_objects (hold_session)
  where status = 'held';

-- ---------------------------------------------------------------------------
-- Ticket-type holds (GA inventory)
-- ---------------------------------------------------------------------------

create table if not exists public.ticket_holds (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  ticket_type_id uuid not null references public.ticket_types (id) on delete cascade,
  quantity integer not null check (quantity between 1 and 50),
  session_token text not null check (char_length(session_token) between 16 and 80),
  expires_at timestamptz not null,
  converted_order_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists ticket_holds_session_idx
  on public.ticket_holds (session_token, expires_at);
create index if not exists ticket_holds_type_active_idx
  on public.ticket_holds (ticket_type_id)
  where converted_order_id is null;

-- ---------------------------------------------------------------------------
-- Orders, items, tickets, payments, refunds, check-ins
-- ---------------------------------------------------------------------------

create table if not exists public.ticketing_orders (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete restrict,
  order_number text not null unique check (char_length(order_number) between 8 and 32),
  first_name text not null check (char_length(btrim(first_name)) between 1 and 80),
  last_name text not null check (char_length(btrim(last_name)) between 1 and 80),
  email text not null check (char_length(email) between 3 and 160),
  phone text check (phone is null or char_length(phone) <= 40),
  subtotal_cents integer not null check (subtotal_cents >= 0),
  fees_cents integer not null default 0 check (fees_cents >= 0),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  payment_status public.payment_status not null default 'pending',
  order_status public.order_status not null default 'pending',
  provider public.payment_provider not null default 'mock',
  provider_ref text,
  checkout_session text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ticketing_orders_event_idx
  on public.ticketing_orders (event_id, created_at desc);
create index if not exists ticketing_orders_email_idx
  on public.ticketing_orders (venue_id, lower(email));

create table if not exists public.ticketing_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.ticketing_orders (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  kind public.order_item_kind not null,
  ticket_type_id uuid references public.ticket_types (id) on delete set null,
  layout_object_id uuid references public.event_layout_objects (id) on delete set null,
  name text not null,
  quantity integer not null default 1 check (quantity between 1 and 50),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  admissions integer not null default 1 check (admissions between 1 and 200),
  created_at timestamptz not null default now()
);

create index if not exists ticketing_order_items_order_idx
  on public.ticketing_order_items (order_id);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.ticketing_orders (id) on delete cascade,
  order_item_id uuid not null references public.ticketing_order_items (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  ticket_type_id uuid references public.ticket_types (id) on delete set null,
  layout_object_id uuid references public.event_layout_objects (id) on delete set null,
  qr_token text not null unique check (char_length(qr_token) between 20 and 80),
  status public.ticket_status not null default 'valid',
  purchaser_name text not null,
  admissions_total integer not null default 1 check (admissions_total between 1 and 200),
  admissions_checked_in integer not null default 0 check (admissions_checked_in >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tickets_checkin_bounds check (admissions_checked_in <= admissions_total)
);

create index if not exists tickets_event_idx on public.tickets (event_id, status);
create index if not exists tickets_qr_idx on public.tickets (qr_token);

create table if not exists public.ticket_checkins (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  quantity integer not null check (quantity between 1 and 200),
  checked_in_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ticket_checkins_ticket_idx
  on public.ticket_checkins (ticket_id, created_at desc);

create table if not exists public.ticketing_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.ticketing_orders (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  provider public.payment_provider not null,
  provider_ref text,
  amount_cents integer not null check (amount_cents >= 0),
  status public.payment_status not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ticketing_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.ticketing_orders (id) on delete cascade,
  payment_id uuid references public.ticketing_payments (id) on delete set null,
  venue_id uuid not null references public.venues (id) on delete cascade,
  amount_cents integer not null check (amount_cents >= 0),
  status public.payment_status not null default 'succeeded',
  reason text check (reason is null or char_length(reason) <= 500),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.event_layout_objects
  drop constraint if exists event_layout_objects_sold_order_fk;
alter table public.event_layout_objects
  add constraint event_layout_objects_sold_order_fk
  foreign key (sold_order_id) references public.ticketing_orders (id) on delete set null;

alter table public.ticket_holds
  drop constraint if exists ticket_holds_converted_order_fk;
alter table public.ticket_holds
  add constraint ticket_holds_converted_order_fk
  foreign key (converted_order_id) references public.ticketing_orders (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

drop trigger if exists venue_layouts_set_updated_at on public.venue_layouts;
create trigger venue_layouts_set_updated_at
  before update on public.venue_layouts
  for each row execute function public.set_updated_at();

drop trigger if exists venue_layout_objects_set_updated_at on public.venue_layout_objects;
create trigger venue_layout_objects_set_updated_at
  before update on public.venue_layout_objects
  for each row execute function public.set_updated_at();

drop trigger if exists event_ticketing_set_updated_at on public.event_ticketing;
create trigger event_ticketing_set_updated_at
  before update on public.event_ticketing
  for each row execute function public.set_updated_at();

drop trigger if exists ticket_types_set_updated_at on public.ticket_types;
create trigger ticket_types_set_updated_at
  before update on public.ticket_types
  for each row execute function public.set_updated_at();

drop trigger if exists event_layouts_set_updated_at on public.event_layouts;
create trigger event_layouts_set_updated_at
  before update on public.event_layouts
  for each row execute function public.set_updated_at();

drop trigger if exists event_layout_objects_set_updated_at on public.event_layout_objects;
create trigger event_layout_objects_set_updated_at
  before update on public.event_layout_objects
  for each row execute function public.set_updated_at();

drop trigger if exists ticketing_orders_set_updated_at on public.ticketing_orders;
create trigger ticketing_orders_set_updated_at
  before update on public.ticketing_orders
  for each row execute function public.set_updated_at();

drop trigger if exists tickets_set_updated_at on public.tickets;
create trigger tickets_set_updated_at
  before update on public.tickets
  for each row execute function public.set_updated_at();

create or replace function public.enforce_ticketing_same_venue()
returns trigger
language plpgsql
as $$
declare
  event_venue uuid;
begin
  select venue_id into event_venue from public.events where id = new.event_id;
  if event_venue is null or event_venue is distinct from new.venue_id then
    raise exception 'ticketing row must match the event venue';
  end if;
  return new;
end;
$$;

drop trigger if exists event_ticketing_same_venue on public.event_ticketing;
create trigger event_ticketing_same_venue
  before insert or update on public.event_ticketing
  for each row execute function public.enforce_ticketing_same_venue();

drop trigger if exists ticket_types_same_venue on public.ticket_types;
create trigger ticket_types_same_venue
  before insert or update on public.ticket_types
  for each row execute function public.enforce_ticketing_same_venue();

-- ---------------------------------------------------------------------------
-- Inventory helpers
-- ---------------------------------------------------------------------------

create or replace function public.release_expired_ticketing_holds()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.event_layout_objects
  set
    status = 'available',
    hold_session = null,
    hold_until = null
  where status = 'held'
    and (hold_until is null or hold_until < now());

  delete from public.ticket_holds
  where converted_order_id is null
    and expires_at < now();
end;
$$;

create or replace function public.ticket_type_committed(p_type_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select sum(i.quantity)::integer
    from public.ticketing_order_items i
    join public.ticketing_orders o on o.id = i.order_id
    where i.ticket_type_id = p_type_id
      and i.kind in ('ticket', 'comp')
      and o.order_status in ('paid', 'partially_refunded')
  ), 0)
  + coalesce((
    select sum(h.quantity)::integer
    from public.ticket_holds h
    where h.ticket_type_id = p_type_id
      and h.converted_order_id is null
      and h.expires_at > now()
  ), 0);
$$;

create or replace function public.hold_event_table(p_object_id uuid, p_session text, p_minutes integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.event_layout_objects;
  minutes integer := greatest(2, least(coalesce(p_minutes, 10), 30));
begin
  perform public.release_expired_ticketing_holds();

  select * into row
  from public.event_layout_objects
  where id = p_object_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Table not found.');
  end if;

  if row.sellable is not true then
    return jsonb_build_object('ok', false, 'error', 'That object is not reservable.');
  end if;

  if row.status = 'held' and row.hold_session = p_session and row.hold_until > now() then
    update public.event_layout_objects
    set hold_until = now() + make_interval(mins => minutes)
    where id = p_object_id
    returning * into row;
    return jsonb_build_object('ok', true, 'status', row.status, 'holdUntil', row.hold_until);
  end if;

  if row.status is distinct from 'available' then
    return jsonb_build_object('ok', false, 'error', 'Table is no longer available.', 'status', row.status);
  end if;

  update public.event_layout_objects
  set
    status = 'held',
    hold_session = p_session,
    hold_until = now() + make_interval(mins => minutes)
  where id = p_object_id
    and status = 'available'
  returning * into row;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Table was just reserved by someone else.');
  end if;

  return jsonb_build_object('ok', true, 'status', row.status, 'holdUntil', row.hold_until);
end;
$$;

create or replace function public.release_event_table_hold(p_object_id uuid, p_session text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.event_layout_objects
  set status = 'available', hold_session = null, hold_until = null
  where id = p_object_id
    and status = 'held'
    and hold_session = p_session;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Hold is not active for this session.');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.hold_ticket_type(p_type_id uuid, p_quantity integer, p_session text, p_minutes integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.ticket_types;
  committed integer;
  minutes integer := greatest(2, least(coalesce(p_minutes, 10), 30));
begin
  perform public.release_expired_ticketing_holds();

  select * into t
  from public.ticket_types
  where id = p_type_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Ticket type not found.');
  end if;
  if t.active is not true or t.visibility <> 'public' then
    return jsonb_build_object('ok', false, 'error', 'That ticket is not on sale.');
  end if;
  if p_quantity < 1 or p_quantity > t.max_per_order then
    return jsonb_build_object('ok', false, 'error', 'Quantity is outside the per-order limit.');
  end if;

  delete from public.ticket_holds
  where ticket_type_id = p_type_id
    and session_token = p_session
    and converted_order_id is null;

  committed := public.ticket_type_committed(p_type_id);
  if committed + p_quantity > (t.quantity - t.blocked_quantity) then
    return jsonb_build_object('ok', false, 'error', 'Not enough tickets remaining.');
  end if;

  insert into public.ticket_holds (event_id, venue_id, ticket_type_id, quantity, session_token, expires_at)
  values (t.event_id, t.venue_id, t.id, p_quantity, p_session, now() + make_interval(mins => minutes));

  return jsonb_build_object('ok', true, 'holdUntil', now() + make_interval(mins => minutes));
end;
$$;

create or replace function public.new_ticketing_order_number()
returns text
language plpgsql
as $$
declare
  candidate text;
begin
  loop
    candidate := 'FB-' || to_char(timezone('America/Chicago', now()), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 5));
    exit when not exists (select 1 from public.ticketing_orders where order_number = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function public.complete_ticketing_checkout(
  p_event_id uuid,
  p_session text,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_provider public.payment_provider,
  p_provider_ref text,
  p_payment_status public.payment_status
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  settings public.event_ticketing;
  hold_row public.ticket_holds;
  table_row public.event_layout_objects;
  order_id uuid;
  order_no text;
  item_id uuid;
  subtotal integer := 0;
  fees integer := 0;
  tax integer := 0;
  total integer := 0;
  admissions integer;
  purchaser text;
begin
  perform public.release_expired_ticketing_holds();

  if p_payment_status is distinct from 'succeeded' then
    return jsonb_build_object('ok', false, 'error', 'Payment was not successful.');
  end if;

  select * into settings from public.event_ticketing where event_id = p_event_id;
  if not found or settings.enabled is not true then
    return jsonb_build_object('ok', false, 'error', 'Ticketing is not enabled for this event.');
  end if;

  if not exists (
    select 1 from public.ticket_holds
    where session_token = p_session and event_id = p_event_id and converted_order_id is null and expires_at > now()
  ) and not exists (
    select 1 from public.event_layout_objects
    where event_id = p_event_id and status = 'held' and hold_session = p_session and hold_until > now()
  ) then
    return jsonb_build_object('ok', false, 'error', 'Your hold expired. Nothing was purchased.');
  end if;

  for hold_row in
    select * from public.ticket_holds
    where session_token = p_session and event_id = p_event_id and converted_order_id is null and expires_at > now()
    for update
  loop
    subtotal := subtotal + (
      select price_cents * hold_row.quantity from public.ticket_types where id = hold_row.ticket_type_id
    );
  end loop;

  for table_row in
    select * from public.event_layout_objects
    where event_id = p_event_id and status = 'held' and hold_session = p_session and hold_until > now()
    for update
  loop
    subtotal := subtotal + coalesce(table_row.price_cents, 0);
  end loop;

  fees := (subtotal * settings.fee_bps) / 10000;
  tax := (subtotal * settings.tax_bps) / 10000;
  total := subtotal + fees + tax;
  purchaser := btrim(p_first_name) || ' ' || btrim(p_last_name);
  order_no := public.new_ticketing_order_number();
  order_id := gen_random_uuid();

  insert into public.ticketing_orders (
    id, venue_id, event_id, order_number, first_name, last_name, email, phone,
    subtotal_cents, fees_cents, tax_cents, total_cents, payment_status, order_status,
    provider, provider_ref, checkout_session
  ) values (
    order_id, settings.venue_id, p_event_id, order_no, btrim(p_first_name), btrim(p_last_name),
    lower(btrim(p_email)), nullif(btrim(p_phone), ''),
    subtotal, fees, tax, total, 'succeeded', 'paid',
    p_provider, p_provider_ref, p_session
  );

  insert into public.ticketing_payments (order_id, venue_id, provider, provider_ref, amount_cents, status)
  values (order_id, settings.venue_id, p_provider, p_provider_ref, total, 'succeeded');

  for hold_row in
    select * from public.ticket_holds
    where session_token = p_session and event_id = p_event_id and converted_order_id is null and expires_at > now()
  loop
    insert into public.ticketing_order_items (
      order_id, event_id, kind, ticket_type_id, name, quantity, unit_price_cents, admissions
    )
    select
      order_id,
      p_event_id,
      'ticket',
      t.id,
      t.name,
      hold_row.quantity,
      t.price_cents,
      hold_row.quantity
    from public.ticket_types t
    where t.id = hold_row.ticket_type_id
    returning id into item_id;

    for i in 1..hold_row.quantity loop
      insert into public.tickets (
        order_id, order_item_id, event_id, venue_id, ticket_type_id, qr_token,
        purchaser_name, admissions_total
      )
      select
        order_id,
        item_id,
        p_event_id,
        settings.venue_id,
        hold_row.ticket_type_id,
        replace(replace(encode(gen_random_bytes(24), 'base64'), '+', '-'), '/', '_'),
        purchaser,
        1;
    end loop;

    update public.ticket_holds
    set converted_order_id = order_id
    where id = hold_row.id;
  end loop;

  for table_row in
    select * from public.event_layout_objects
    where event_id = p_event_id and status = 'held' and hold_session = p_session and hold_until > now()
  loop
    admissions := greatest(table_row.capacity, 1);
    insert into public.ticketing_order_items (
      order_id, event_id, kind, layout_object_id, name, quantity, unit_price_cents, admissions
    ) values (
      order_id, p_event_id, 'table', table_row.id, table_row.name, 1, coalesce(table_row.price_cents, 0), admissions
    ) returning id into item_id;

    insert into public.tickets (
      order_id, order_item_id, event_id, venue_id, layout_object_id, qr_token,
      purchaser_name, admissions_total
    ) values (
      order_id, item_id, p_event_id, settings.venue_id, table_row.id,
      replace(replace(encode(gen_random_bytes(24), 'base64'), '+', '-'), '/', '_'),
      purchaser, admissions
    );

    update public.event_layout_objects
    set status = 'sold', sold_order_id = order_id, hold_session = null, hold_until = null
    where id = table_row.id
      and status = 'held'
      and hold_session = p_session;
  end loop;

  return jsonb_build_object('ok', true, 'orderId', order_id, 'orderNumber', order_no, 'totalCents', total);
end;
$$;

create or replace function public.check_in_ticket(p_ticket_id uuid, p_quantity integer, p_staff uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tickets;
  qty integer := greatest(1, p_quantity);
begin
  select * into t from public.tickets where id = p_ticket_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Ticket not found.');
  end if;
  if t.status in ('void', 'refunded') then
    return jsonb_build_object('ok', false, 'error', 'This ticket is not valid.');
  end if;
  if t.admissions_checked_in + qty > t.admissions_total then
    return jsonb_build_object('ok', false, 'error', 'That would exceed remaining admissions.');
  end if;

  update public.tickets
  set
    admissions_checked_in = admissions_checked_in + qty,
    status = case when admissions_checked_in + qty >= admissions_total then 'checked_in'::public.ticket_status else status end
  where id = p_ticket_id
  returning * into t;

  insert into public.ticket_checkins (ticket_id, event_id, venue_id, quantity, checked_in_by)
  values (t.id, t.event_id, t.venue_id, qty, p_staff);

  return jsonb_build_object(
    'ok', true,
    'checkedIn', t.admissions_checked_in,
    'total', t.admissions_total,
    'status', t.status
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Public views (no PII, no internal notes)
-- ---------------------------------------------------------------------------

create or replace view public.ticket_event_listings
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
  t.doors_at,
  t.capacity,
  t.tables_enabled,
  t.refund_policy,
  t.age_restriction,
  t.parking_notes,
  t.venue_notes,
  t.sales_start,
  t.sales_end,
  t.max_tickets_per_order,
  t.hold_minutes
from public.events e
join public.event_ticketing t on t.event_id = e.id
where t.enabled = true
  and e.status = 'published'
  and e.visibility = 'public'
  and e.archived_at is null;

create or replace view public.ticket_type_listings
with (security_invoker = false)
as
select
  tt.id,
  tt.event_id,
  tt.name,
  tt.description,
  tt.kind,
  tt.price_cents,
  tt.max_per_order,
  tt.sort_order,
  greatest(tt.quantity - tt.blocked_quantity - public.ticket_type_committed(tt.id), 0) as remaining
from public.ticket_types tt
join public.event_ticketing t on t.event_id = tt.event_id
join public.events e on e.id = tt.event_id
where t.enabled = true
  and tt.active = true
  and tt.visibility = 'public'
  and e.status = 'published'
  and e.visibility = 'public'
  and e.archived_at is null;

create or replace view public.event_table_listings
with (security_invoker = false)
as
select
  o.id,
  o.event_id,
  o.name,
  o.table_number,
  o.section,
  o.capacity,
  o.price_cents,
  o.vip,
  o.x_position,
  o.y_position,
  o.width,
  o.height,
  o.rotation,
  o.shape,
  o.object_type,
  case
    when o.status = 'held' and o.hold_until is not null and o.hold_until < now() then 'available'
    else o.status
  end as status
from public.event_layout_objects o
join public.event_ticketing t on t.event_id = o.event_id
join public.events e on e.id = o.event_id
where t.enabled = true
  and o.sellable = true
  and e.status = 'published'
  and e.visibility = 'public'
  and e.archived_at is null;

create or replace view public.event_layout_public
with (security_invoker = false)
as
select
  l.id,
  l.event_id,
  l.canvas_width,
  l.canvas_height
from public.event_layouts l
join public.event_ticketing t on t.event_id = l.event_id
join public.events e on e.id = l.event_id
where t.enabled = true
  and e.status = 'published'
  and e.visibility = 'public'
  and e.archived_at is null;

create or replace view public.event_layout_objects_public
with (security_invoker = false)
as
select
  o.id,
  o.event_id,
  o.name,
  o.object_type,
  o.x_position,
  o.y_position,
  o.width,
  o.height,
  o.rotation,
  o.shape,
  o.sellable,
  o.capacity
from public.event_layout_objects o
join public.event_ticketing t on t.event_id = o.event_id
join public.events e on e.id = o.event_id
where t.enabled = true
  and o.sellable = false
  and e.status = 'published'
  and e.visibility = 'public'
  and e.archived_at is null;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.venue_layouts enable row level security;
alter table public.venue_layouts force row level security;
alter table public.venue_layout_objects enable row level security;
alter table public.venue_layout_objects force row level security;
alter table public.event_ticketing enable row level security;
alter table public.event_ticketing force row level security;
alter table public.ticket_types enable row level security;
alter table public.ticket_types force row level security;
alter table public.event_layouts enable row level security;
alter table public.event_layouts force row level security;
alter table public.event_layout_objects enable row level security;
alter table public.event_layout_objects force row level security;
alter table public.ticket_holds enable row level security;
alter table public.ticket_holds force row level security;
alter table public.ticketing_orders enable row level security;
alter table public.ticketing_orders force row level security;
alter table public.ticketing_order_items enable row level security;
alter table public.ticketing_order_items force row level security;
alter table public.tickets enable row level security;
alter table public.tickets force row level security;
alter table public.ticket_checkins enable row level security;
alter table public.ticket_checkins force row level security;
alter table public.ticketing_payments enable row level security;
alter table public.ticketing_payments force row level security;
alter table public.ticketing_refunds enable row level security;
alter table public.ticketing_refunds force row level security;

revoke all on public.venue_layouts from anon, public, authenticated;
revoke all on public.venue_layout_objects from anon, public, authenticated;
revoke all on public.event_ticketing from anon, public, authenticated;
revoke all on public.ticket_types from anon, public, authenticated;
revoke all on public.event_layouts from anon, public, authenticated;
revoke all on public.event_layout_objects from anon, public, authenticated;
revoke all on public.ticket_holds from anon, public, authenticated;
revoke all on public.ticketing_orders from anon, public, authenticated;
revoke all on public.ticketing_order_items from anon, public, authenticated;
revoke all on public.tickets from anon, public, authenticated;
revoke all on public.ticket_checkins from anon, public, authenticated;
revoke all on public.ticketing_payments from anon, public, authenticated;
revoke all on public.ticketing_refunds from anon, public, authenticated;

grant select, insert, update, delete on public.venue_layouts to authenticated;
grant select, insert, update, delete on public.venue_layout_objects to authenticated;
grant select, insert, update, delete on public.event_ticketing to authenticated;
grant select, insert, update, delete on public.ticket_types to authenticated;
grant select, insert, update, delete on public.event_layouts to authenticated;
grant select, insert, update, delete on public.event_layout_objects to authenticated;
grant select on public.ticketing_orders to authenticated;
grant select on public.ticketing_order_items to authenticated;
grant select on public.tickets to authenticated;
grant select on public.ticket_checkins to authenticated;
grant select on public.ticketing_payments to authenticated;
grant select on public.ticketing_refunds to authenticated;

grant select on public.ticket_event_listings to anon, authenticated;
grant select on public.ticket_type_listings to anon, authenticated;
grant select on public.event_table_listings to anon, authenticated;
grant select on public.event_layout_public to anon, authenticated;
grant select on public.event_layout_objects_public to anon, authenticated;

revoke all on function public.hold_event_table(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.release_event_table_hold(uuid, text) from public, anon, authenticated;
revoke all on function public.hold_ticket_type(uuid, integer, text, integer) from public, anon, authenticated;
revoke all on function public.complete_ticketing_checkout(uuid, text, text, text, text, text, public.payment_provider, text, public.payment_status) from public, anon, authenticated;
revoke all on function public.check_in_ticket(uuid, integer, uuid) from public, anon, authenticated;
revoke all on function public.release_expired_ticketing_holds() from public, anon, authenticated;
revoke all on function public.ticket_type_committed(uuid) from public, anon;

-- Views call ticket_type_committed; grant execute to anon for that helper only.
grant execute on function public.ticket_type_committed(uuid) to anon, authenticated;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'venue_layouts',
    'venue_layout_objects',
    'event_ticketing',
    'ticket_types',
    'event_layouts',
    'event_layout_objects'
  ]
  loop
    execute format('drop policy if exists %I_select_member on public.%I', tbl, tbl);
    execute format(
      'create policy %I_select_member on public.%I for select to authenticated using (public.is_venue_member(venue_id))',
      tbl, tbl
    );
    execute format('drop policy if exists %I_write_managers on public.%I', tbl, tbl);
    execute format(
      'create policy %I_insert_managers on public.%I for insert to authenticated with check (public.has_venue_role(venue_id, array[''admin'', ''manager'']::public.staff_role[]))',
      tbl, tbl
    );
    execute format(
      'create policy %I_update_managers on public.%I for update to authenticated using (public.has_venue_role(venue_id, array[''admin'', ''manager'']::public.staff_role[])) with check (public.has_venue_role(venue_id, array[''admin'', ''manager'']::public.staff_role[]))',
      tbl, tbl
    );
    execute format(
      'create policy %I_delete_managers on public.%I for delete to authenticated using (public.has_venue_role(venue_id, array[''admin'', ''manager'']::public.staff_role[]))',
      tbl, tbl
    );
  end loop;
end
$$;

drop policy if exists ticketing_orders_select_member on public.ticketing_orders;
create policy ticketing_orders_select_member
  on public.ticketing_orders for select to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists ticketing_order_items_select_member on public.ticketing_order_items;
create policy ticketing_order_items_select_member
  on public.ticketing_order_items for select to authenticated
  using (exists (
    select 1 from public.ticketing_orders o
    where o.id = order_id and public.is_venue_member(o.venue_id)
  ));

drop policy if exists tickets_select_member on public.tickets;
create policy tickets_select_member
  on public.tickets for select to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists ticket_checkins_select_member on public.ticket_checkins;
create policy ticket_checkins_select_member
  on public.ticket_checkins for select to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists ticketing_payments_select_member on public.ticketing_payments;
create policy ticketing_payments_select_member
  on public.ticketing_payments for select to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists ticketing_refunds_select_member on public.ticketing_refunds;
create policy ticketing_refunds_select_member
  on public.ticketing_refunds for select to authenticated
  using (public.is_venue_member(venue_id));

-- ---------------------------------------------------------------------------
-- Default FloBama main-room layout (Tables 1–28)
-- ---------------------------------------------------------------------------

insert into public.venue_layouts (id, venue_id, name, is_default, canvas_width, canvas_height)
values (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'Main room',
  true,
  1200,
  860
)
on conflict (id) do nothing;

insert into public.venue_layout_objects (
  layout_id, venue_id, object_type, name, capacity, x_position, y_position, width, height, shape, sellable, sort_order, section
)
select
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  v.object_type::public.layout_object_type,
  v.name,
  v.capacity,
  v.x,
  v.y,
  v.w,
  v.h,
  v.shape::public.layout_shape,
  false,
  v.sort,
  v.section
from (
  values
    ('stage', 'Stage', 0, 360, 24, 480, 88, 'rect', 0, 'Stage'),
    ('dance_floor', 'Dance floor', 0, 360, 128, 480, 200, 'rect', 1, 'Floor'),
    ('bar', 'Bar', 0, 24, 160, 88, 420, 'rect', 2, 'Bar'),
    ('entrance', 'Entrance', 0, 520, 800, 160, 40, 'rect', 3, 'Front'),
    ('vip_area', 'VIP rail', 0, 360, 640, 480, 36, 'rect', 4, 'VIP'),
    ('label', 'FloBama Music Hall', 0, 420, 820, 360, 28, 'rect', 5, null)
) as v(object_type, name, capacity, x, y, w, h, shape, sort, section)
where not exists (
  select 1 from public.venue_layout_objects o
  where o.layout_id = '22222222-2222-4222-8222-222222222222'
    and o.object_type <> 'table'
);

insert into public.venue_layout_objects (
  layout_id, venue_id, object_type, name, capacity, x_position, y_position, width, height,
  shape, table_number, section, default_price_cents, sellable, sort_order
)
select
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'table',
  'Table ' || gs.n,
  case when gs.n >= 25 then 6 else 4 end,
  case
    when gs.n <= 8 then 140
    when gs.n <= 16 then 980
    else 180 + ((gs.n - 17) % 6) * 140
  end,
  case
    when gs.n <= 8 then 140 + (gs.n - 1) * 78
    when gs.n <= 16 then 140 + (gs.n - 9) * 78
    when gs.n <= 22 then 520
    else 620
  end,
  88,
  64,
  'round',
  gs.n::text,
  case when gs.n >= 25 then 'VIP' when gs.n <= 16 then 'Main floor' else 'Rear' end,
  case when gs.n >= 25 then 25000 else 15000 end,
  true,
  10 + gs.n
from generate_series(1, 28) as gs(n)
where not exists (
  select 1 from public.venue_layout_objects o
  where o.layout_id = '22222222-2222-4222-8222-222222222222'
    and o.table_number = gs.n::text
);

notify pgrst, 'reload schema';
