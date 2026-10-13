-- FloBama display devices: Mac Local Runner + Android Vertical Player pairing, status, telemetry.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'display_device_kind') then
    create type public.display_device_kind as enum ('led_runner', 'vertical_kiosk');
  end if;
end
$$;

create table if not exists public.display_device_pairing_codes (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  code_hash text not null check (char_length(code_hash) = 64),
  intended_kind public.display_device_kind not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists display_device_pairing_codes_venue_idx
  on public.display_device_pairing_codes (venue_id, expires_at desc);

create table if not exists public.display_devices (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  label text not null default 'FloBama Display' check (char_length(btrim(label)) between 1 and 120),
  kind public.display_device_kind not null,
  token_hash text not null check (char_length(token_hash) = 64),
  revoked_at timestamptz,
  last_seen_at timestamptz,
  app_version text,
  hostname text,
  capabilities jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists display_devices_token_hash_uidx
  on public.display_devices (token_hash)
  where revoked_at is null;

create index if not exists display_devices_venue_kind_idx
  on public.display_devices (venue_id, kind)
  where revoked_at is null;

drop trigger if exists display_devices_set_updated_at on public.display_devices;
create trigger display_devices_set_updated_at
  before update on public.display_devices
  for each row execute function public.set_updated_at();

create table if not exists public.display_device_status (
  device_id uuid primary key references public.display_devices (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  obs_connected boolean,
  program_scene text,
  cache_bytes bigint check (cache_bytes is null or cache_bytes >= 0),
  cache_limit_bytes bigint check (cache_limit_bytes is null or cache_limit_bytes >= 0),
  assets_ready integer check (assets_ready is null or assets_ready >= 0),
  assets_pending integer check (assets_pending is null or assets_pending >= 0),
  manifest_revision text,
  current_asset_id text,
  playback_state text,
  download_progress jsonb not null default '{}'::jsonb,
  disk_free_bytes bigint,
  last_error text,
  safe_refresh_requested_at timestamptz,
  reported_at timestamptz not null default now()
);

create index if not exists display_device_status_venue_idx
  on public.display_device_status (venue_id, reported_at desc);

alter table public.display_device_pairing_codes enable row level security;
alter table public.display_device_pairing_codes force row level security;
alter table public.display_devices enable row level security;
alter table public.display_devices force row level security;
alter table public.display_device_status enable row level security;
alter table public.display_device_status force row level security;

revoke all on public.display_device_pairing_codes from anon, public, authenticated;
revoke all on public.display_devices from anon, public, authenticated;
revoke all on public.display_device_status from anon, public, authenticated;

grant select, insert on public.display_device_pairing_codes to authenticated;
grant select, update on public.display_devices to authenticated;
grant select on public.display_device_status to authenticated;

drop policy if exists display_pairing_select_admin on public.display_device_pairing_codes;
create policy display_pairing_select_admin
  on public.display_device_pairing_codes for select to authenticated
  using (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));

drop policy if exists display_pairing_insert_admin on public.display_device_pairing_codes;
create policy display_pairing_insert_admin
  on public.display_device_pairing_codes for insert to authenticated
  with check (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));

drop policy if exists display_devices_select_member on public.display_devices;
create policy display_devices_select_member
  on public.display_devices for select to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists display_devices_update_admin on public.display_devices;
create policy display_devices_update_admin
  on public.display_devices for update to authenticated
  using (public.has_venue_role(venue_id, array['admin']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));

drop policy if exists display_device_status_select_member on public.display_device_status;
create policy display_device_status_select_member
  on public.display_device_status for select to authenticated
  using (public.is_venue_member(venue_id));

notify pgrst, 'reload schema';
