-- SpotOn POS integration: settings, webhook inbox, sync jobs, normalized orders,
-- menu mappings, and category reporting. Secrets stay in environment variables.
-- SpotOn remains the source of truth for POS transactions; FloBama stores snapshots.

-- ---------------------------------------------------------------------------
-- Optional booking cost on events (distinct from a zero-dollar fee)
-- ---------------------------------------------------------------------------
alter table public.events
  add column if not exists booking_cost_cents integer
    check (booking_cost_cents is null or booking_cost_cents >= 0);

alter table public.events
  add column if not exists booking_cost_notes text
    check (booking_cost_notes is null or char_length(booking_cost_notes) <= 500);

comment on column public.events.booking_cost_cents is
  'Optional artist/booking fee in integer cents. NULL means unknown/missing, not $0.';

-- ---------------------------------------------------------------------------
-- Non-secret SpotOn connection settings (one row per venue)
-- ---------------------------------------------------------------------------
create table if not exists public.spoton_settings (
  venue_id uuid primary key references public.venues (id) on delete cascade,
  api_product text not null default 'none'
    check (api_product in ('none', 'restaurant_export', 'central_api')),
  location_id text
    check (location_id is null or char_length(btrim(location_id)) between 1 and 120),
  business_day_cutoff_local time not null default time '04:00',
  event_window_pre_minutes integer not null default 0
    check (event_window_pre_minutes >= 0 and event_window_pre_minutes <= 720),
  event_window_post_minutes integer not null default 0
    check (event_window_post_minutes >= 0 and event_window_post_minutes <= 720),
  webhook_status text not null default 'not_configured'
    check (webhook_status in (
      'not_configured', 'configured_unverified', 'verified', 'permission_denied', 'unavailable'
    )),
  reporting_status text not null default 'not_configured'
    check (reporting_status in (
      'not_configured', 'configured_unverified', 'verified', 'permission_denied', 'unavailable'
    )),
  menu_status text not null default 'not_configured'
    check (menu_status in (
      'not_configured', 'configured_unverified', 'verified', 'permission_denied', 'unavailable'
    )),
  last_webhook_at timestamptz,
  last_webhook_event_id text,
  last_processed_event_id text,
  last_processed_event_at timestamptz,
  last_successful_sync_at timestamptz,
  coverage_through timestamptz,
  last_connection_test_at timestamptz,
  last_connection_test_ok boolean,
  last_connection_test_message text,
  sync_enabled boolean not null default false,
  publish_mapped_menu boolean not null default false,
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists spoton_settings_set_updated_at on public.spoton_settings;
create trigger spoton_settings_set_updated_at
  before update on public.spoton_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Webhook inbox (authenticated payloads only; allowlisted fields)
-- ---------------------------------------------------------------------------
create table if not exists public.spoton_webhook_inbox (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  provider text not null default 'spoton_central'
    check (provider in ('spoton_central')),
  location_id text not null check (char_length(btrim(location_id)) between 1 and 120),
  event_id text not null check (char_length(btrim(event_id)) between 1 and 200),
  event_category text not null check (char_length(btrim(event_category)) between 1 and 80),
  event_type text check (event_type is null or char_length(event_type) <= 80),
  event_timestamp timestamptz,
  payload jsonb not null default '{}'::jsonb,
  payload_bytes integer not null check (payload_bytes >= 0),
  signature_version text not null default 'v1',
  processing_status text not null default 'pending'
    check (processing_status in (
      'pending', 'processing', 'processed', 'ignored', 'failed'
    )),
  processing_error text,
  processed_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  lease_owner text,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, location_id, event_id)
);

create index if not exists spoton_webhook_inbox_queue_idx
  on public.spoton_webhook_inbox (processing_status, next_attempt_at)
  where processing_status in ('pending', 'failed');

create index if not exists spoton_webhook_inbox_venue_idx
  on public.spoton_webhook_inbox (venue_id, created_at desc);

drop trigger if exists spoton_webhook_inbox_set_updated_at on public.spoton_webhook_inbox;
create trigger spoton_webhook_inbox_set_updated_at
  before update on public.spoton_webhook_inbox
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Sync runs / jobs (manual, cron, backfill, replay)
-- ---------------------------------------------------------------------------
create table if not exists public.spoton_sync_runs (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  kind text not null
    check (kind in (
      'incremental_orders',
      'backfill_orders',
      'manual_orders',
      'reconcile_orders',
      'menu_sync',
      'webhook_process',
      'connection_test',
      'replay_webhook'
    )),
  api_product text not null
    check (api_product in ('none', 'restaurant_export', 'central_api', 'webhook')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  requested_by uuid references auth.users (id) on delete set null,
  window_start timestamptz,
  window_end timestamptz,
  checkpoint_before timestamptz,
  checkpoint_after timestamptz,
  coverage_through timestamptz,
  orders_upserted integer not null default 0 check (orders_upserted >= 0),
  orders_skipped integer not null default 0 check (orders_skipped >= 0),
  error_safe text,
  details jsonb not null default '{}'::jsonb,
  lease_owner text,
  lease_expires_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists spoton_sync_runs_venue_idx
  on public.spoton_sync_runs (venue_id, created_at desc);

create index if not exists spoton_sync_runs_queue_idx
  on public.spoton_sync_runs (status, created_at)
  where status in ('queued', 'running');

drop trigger if exists spoton_sync_runs_set_updated_at on public.spoton_sync_runs;
create trigger spoton_sync_runs_set_updated_at
  before update on public.spoton_sync_runs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Normalized orders (authoritative snapshots; money in integer cents)
-- ---------------------------------------------------------------------------
create table if not exists public.spoton_orders (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  api_product text not null
    check (api_product in ('restaurant_export', 'central_api', 'webhook')),
  location_id text not null,
  external_order_id text not null,
  order_number text,
  order_name text,
  order_type_name text,
  order_status text,
  deleted boolean not null default false,
  scheduled boolean not null default false,
  gift_card_or_liability boolean not null default false,
  business_date date,
  fiscal_date date,
  timezone text not null default 'America/Chicago',
  opened_at timestamptz,
  closed_at timestamptz,
  released_at timestamptz,
  source_updated_at timestamptz,
  source_version text,
  attribution_basis text not null default 'item_timestamps'
    check (attribution_basis in ('item_timestamps', 'order_timestamps', 'unknown')),
  guest_count integer check (guest_count is null or guest_count >= 0),
  table_number text,
  currency text not null default 'USD',
  gross_sales_cents bigint not null default 0,
  discounts_cents bigint not null default 0,
  refunds_cents bigint not null default 0,
  net_sales_cents bigint not null default 0,
  tax_cents bigint not null default 0,
  tip_cents bigint not null default 0,
  surcharge_cents bigint not null default 0,
  total_cents bigint not null default 0,
  liability_cents bigint not null default 0,
  is_complete_snapshot boolean not null default true,
  raw_allowlist jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, api_product, external_order_id)
);

create index if not exists spoton_orders_venue_business_date_idx
  on public.spoton_orders (venue_id, business_date desc);

create index if not exists spoton_orders_venue_closed_at_idx
  on public.spoton_orders (venue_id, closed_at desc nulls last);

create index if not exists spoton_orders_venue_updated_idx
  on public.spoton_orders (venue_id, source_updated_at desc nulls last);

drop trigger if exists spoton_orders_set_updated_at on public.spoton_orders;
create trigger spoton_orders_set_updated_at
  before update on public.spoton_orders
  for each row execute function public.set_updated_at();

create table if not exists public.spoton_order_items (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  order_id uuid not null references public.spoton_orders (id) on delete cascade,
  external_item_id text,
  external_line_id text,
  name text not null,
  quantity numeric(14, 4) not null default 1,
  voided boolean not null default false,
  gift_card_issue_reload boolean not null default false,
  reporting_category_id text,
  reporting_category_name text,
  parent_reporting_category_id text,
  parent_reporting_category_name text,
  item_created_at timestamptz,
  pre_discounts_cents bigint not null default 0,
  discounts_cents bigint not null default 0,
  post_discounts_cents bigint not null default 0,
  tax_cents bigint not null default 0,
  total_cents bigint not null default 0,
  net_sales_cents bigint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists spoton_order_items_order_idx
  on public.spoton_order_items (order_id);

create index if not exists spoton_order_items_venue_created_idx
  on public.spoton_order_items (venue_id, item_created_at);

create table if not exists public.spoton_order_adjustments (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  order_id uuid not null references public.spoton_orders (id) on delete cascade,
  kind text not null check (kind in ('discount', 'tax', 'surcharge', 'fee', 'liability', 'refund')),
  external_id text,
  name text,
  amount_cents bigint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists spoton_order_adjustments_order_idx
  on public.spoton_order_adjustments (order_id);

create table if not exists public.spoton_order_payments (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  order_id uuid not null references public.spoton_orders (id) on delete cascade,
  external_payment_option_id text,
  payment_name text,
  amount_cents bigint not null default 0,
  tip_cents bigint not null default 0,
  tip_deduction_cents bigint not null default 0,
  surcharge_cents bigint not null default 0,
  paid_at timestamptz,
  card_type text,
  -- Never store full PAN, CVV, or cardholder PII beyond optional last4 label.
  card_last4 text check (card_last4 is null or card_last4 ~ '^[0-9*]{0,8}$'),
  created_at timestamptz not null default now()
);

create index if not exists spoton_order_payments_order_idx
  on public.spoton_order_payments (order_id);

-- ---------------------------------------------------------------------------
-- Menu items + explicit FloBama mappings + reporting category buckets
-- ---------------------------------------------------------------------------
create table if not exists public.spoton_menu_items (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  api_product text not null
    check (api_product in ('restaurant_export', 'central_api')),
  location_id text not null,
  external_item_id text not null,
  menu_id text,
  name text not null,
  description text,
  reporting_category_id text,
  reporting_category_name text,
  available boolean,
  availability_known boolean not null default false,
  availability_updated_at timestamptz,
  source_updated_at timestamptz,
  raw_allowlist jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, api_product, external_item_id)
);

create index if not exists spoton_menu_items_venue_idx
  on public.spoton_menu_items (venue_id, name);

drop trigger if exists spoton_menu_items_set_updated_at on public.spoton_menu_items;
create trigger spoton_menu_items_set_updated_at
  before update on public.spoton_menu_items
  for each row execute function public.set_updated_at();

create table if not exists public.spoton_menu_mappings (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  spoton_menu_item_id uuid not null references public.spoton_menu_items (id) on delete cascade,
  local_name text,
  local_description text,
  local_artwork_url text,
  publish_public boolean not null default false,
  field_ownership jsonb not null default '{"name":"local","description":"local","artwork":"local"}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, spoton_menu_item_id)
);

drop trigger if exists spoton_menu_mappings_set_updated_at on public.spoton_menu_mappings;
create trigger spoton_menu_mappings_set_updated_at
  before update on public.spoton_menu_mappings
  for each row execute function public.set_updated_at();

create table if not exists public.spoton_category_mappings (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  external_category_id text,
  external_category_name text not null,
  reporting_bucket text not null default 'unmapped'
    check (reporting_bucket in ('food', 'alcohol', 'other', 'unmapped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, external_category_name)
);

drop trigger if exists spoton_category_mappings_set_updated_at on public.spoton_category_mappings;
create trigger spoton_category_mappings_set_updated_at
  before update on public.spoton_category_mappings
  for each row execute function public.set_updated_at();

-- Per-event analysis window overrides (optional)
create table if not exists public.spoton_event_windows (
  event_id uuid primary key references public.events (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  window_start_at timestamptz,
  window_end_at timestamptz,
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    window_start_at is null
    or window_end_at is null
    or window_end_at > window_start_at
  )
);

drop trigger if exists spoton_event_windows_set_updated_at on public.spoton_event_windows;
create trigger spoton_event_windows_set_updated_at
  before update on public.spoton_event_windows
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Grants + RLS
-- Settings readable by admins; financial tables admin-only initially.
-- Webhook inbox / sync internals: service role only (no authenticated grants).
-- ---------------------------------------------------------------------------
alter table public.spoton_settings enable row level security;
alter table public.spoton_settings force row level security;
alter table public.spoton_webhook_inbox enable row level security;
alter table public.spoton_webhook_inbox force row level security;
alter table public.spoton_sync_runs enable row level security;
alter table public.spoton_sync_runs force row level security;
alter table public.spoton_orders enable row level security;
alter table public.spoton_orders force row level security;
alter table public.spoton_order_items enable row level security;
alter table public.spoton_order_items force row level security;
alter table public.spoton_order_adjustments enable row level security;
alter table public.spoton_order_adjustments force row level security;
alter table public.spoton_order_payments enable row level security;
alter table public.spoton_order_payments force row level security;
alter table public.spoton_menu_items enable row level security;
alter table public.spoton_menu_items force row level security;
alter table public.spoton_menu_mappings enable row level security;
alter table public.spoton_menu_mappings force row level security;
alter table public.spoton_category_mappings enable row level security;
alter table public.spoton_category_mappings force row level security;
alter table public.spoton_event_windows enable row level security;
alter table public.spoton_event_windows force row level security;

revoke all on public.spoton_settings from anon, public;
revoke all on public.spoton_webhook_inbox from anon, public, authenticated;
revoke all on public.spoton_sync_runs from anon, public;
revoke all on public.spoton_orders from anon, public;
revoke all on public.spoton_order_items from anon, public;
revoke all on public.spoton_order_adjustments from anon, public;
revoke all on public.spoton_order_payments from anon, public;
revoke all on public.spoton_menu_items from anon, public;
revoke all on public.spoton_menu_mappings from anon, public;
revoke all on public.spoton_category_mappings from anon, public;
revoke all on public.spoton_event_windows from anon, public;

grant select, insert, update on public.spoton_settings to authenticated;
grant select on public.spoton_sync_runs to authenticated;
grant select on public.spoton_orders to authenticated;
grant select on public.spoton_order_items to authenticated;
grant select on public.spoton_order_adjustments to authenticated;
grant select on public.spoton_order_payments to authenticated;
grant select on public.spoton_menu_items to authenticated;
grant select, insert, update, delete on public.spoton_menu_mappings to authenticated;
grant select, insert, update, delete on public.spoton_category_mappings to authenticated;
grant select, insert, update, delete on public.spoton_event_windows to authenticated;

-- Admins manage connection settings
drop policy if exists spoton_settings_select_admin on public.spoton_settings;
create policy spoton_settings_select_admin
  on public.spoton_settings for select to authenticated
  using (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));

drop policy if exists spoton_settings_write_admin on public.spoton_settings;
create policy spoton_settings_write_admin
  on public.spoton_settings for all to authenticated
  using (public.has_venue_role(venue_id, array['admin']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));

-- Financial reports: administrators only (no dedicated finance role yet)
drop policy if exists spoton_orders_select_admin on public.spoton_orders;
create policy spoton_orders_select_admin
  on public.spoton_orders for select to authenticated
  using (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));

drop policy if exists spoton_order_items_select_admin on public.spoton_order_items;
create policy spoton_order_items_select_admin
  on public.spoton_order_items for select to authenticated
  using (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));

drop policy if exists spoton_order_adjustments_select_admin on public.spoton_order_adjustments;
create policy spoton_order_adjustments_select_admin
  on public.spoton_order_adjustments for select to authenticated
  using (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));

drop policy if exists spoton_order_payments_select_admin on public.spoton_order_payments;
create policy spoton_order_payments_select_admin
  on public.spoton_order_payments for select to authenticated
  using (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));

drop policy if exists spoton_sync_runs_select_admin on public.spoton_sync_runs;
create policy spoton_sync_runs_select_admin
  on public.spoton_sync_runs for select to authenticated
  using (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));

drop policy if exists spoton_menu_items_select_admin on public.spoton_menu_items;
create policy spoton_menu_items_select_admin
  on public.spoton_menu_items for select to authenticated
  using (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));

drop policy if exists spoton_menu_mappings_admin on public.spoton_menu_mappings;
create policy spoton_menu_mappings_admin
  on public.spoton_menu_mappings for all to authenticated
  using (public.has_venue_role(venue_id, array['admin']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));

drop policy if exists spoton_category_mappings_admin on public.spoton_category_mappings;
create policy spoton_category_mappings_admin
  on public.spoton_category_mappings for all to authenticated
  using (public.has_venue_role(venue_id, array['admin']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));

drop policy if exists spoton_event_windows_admin on public.spoton_event_windows;
create policy spoton_event_windows_admin
  on public.spoton_event_windows for all to authenticated
  using (public.has_venue_role(venue_id, array['admin']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));

-- Public sanitized menu view: only explicitly mapped + publish_public items
create or replace view public.spoton_public_menu_items
with (security_invoker = true)
as
select
  m.venue_id,
  i.external_item_id,
  coalesce(nullif(btrim(m.local_name), ''), i.name) as name,
  coalesce(m.local_description, i.description) as description,
  m.local_artwork_url as artwork_url,
  case
    when i.availability_known then i.available
    else null
  end as available,
  i.availability_known,
  i.availability_updated_at,
  i.updated_at as source_updated_at
from public.spoton_menu_mappings m
join public.spoton_menu_items i on i.id = m.spoton_menu_item_id
join public.spoton_settings s on s.venue_id = m.venue_id
where m.publish_public = true
  and s.publish_mapped_menu = true;

revoke all on public.spoton_public_menu_items from anon, public;
grant select on public.spoton_public_menu_items to anon, authenticated;

insert into public.spoton_settings (venue_id)
values ('11111111-1111-4111-8111-111111111111')
on conflict (venue_id) do nothing;
