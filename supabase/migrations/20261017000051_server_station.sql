-- FloBama Server Station: settings, kiosk devices, PINs, temporary LED content,
-- timed overrides, scene approval, and audit log.
-- Requires 20261017000050_server_role.sql to be committed first.

-- ---------------------------------------------------------------------------
-- Membership policy: allow assigning interactor + server roles
-- ---------------------------------------------------------------------------
drop policy if exists venue_memberships_update_admin on public.venue_memberships;
create policy venue_memberships_update_admin
  on public.venue_memberships
  for update
  to authenticated
  using (public.has_venue_role(venue_id, array['admin']::public.staff_role[]))
  with check (
    public.has_venue_role(
      venue_id,
      array['admin', 'manager', 'interactor', 'viewer', 'server']::public.staff_role[]
    )
  );

-- Staff menus known list: add server
alter table public.venue_memberships
  drop constraint if exists venue_memberships_menus_known;

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
      'ticketing',
      'spoton',
      'artists',
      'settings',
      'server'
    ]::text[]
  );

create or replace function public.list_venue_staff(p_venue_id uuid)
returns table (
  user_id uuid,
  role public.staff_role,
  display_name text,
  email text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.user_id,
    m.role,
    coalesce(p.display_name, ''),
    u.email::text,
    m.created_at
  from public.venue_memberships m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = m.user_id
  where m.venue_id = p_venue_id
    and public.is_venue_member(p_venue_id)
  order by
    case m.role
      when 'admin' then 0
      when 'manager' then 1
      when 'server' then 2
      when 'interactor' then 3
      else 4
    end,
    coalesce(nullif(p.display_name, ''), u.email);
$$;

revoke all on function public.list_venue_staff(uuid) from public, anon, authenticated;
grant execute on function public.list_venue_staff(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- LED scenes: server approval flag
-- ---------------------------------------------------------------------------
alter table public.led_wall_scenes
  add column if not exists server_approved boolean not null default false;

create index if not exists led_wall_scenes_server_approved_idx
  on public.led_wall_scenes (venue_id)
  where server_approved = true and enabled = true and archived_at is null;

-- ---------------------------------------------------------------------------
-- Runtime activation source: server_override
-- ---------------------------------------------------------------------------
alter table public.led_wall_runtime
  drop constraint if exists led_wall_runtime_activation_source_check;

alter table public.led_wall_runtime
  add constraint led_wall_runtime_activation_source_check check (
    activation_source in ('manual', 'artist_auto', 'ad_roll', 'server_override')
  );

-- ---------------------------------------------------------------------------
-- Server Station settings
-- ---------------------------------------------------------------------------
create table if not exists public.server_station_settings (
  venue_id uuid primary key references public.venues (id) on delete cascade,
  show_now_enabled boolean not null default true,
  birthday_approval_required boolean not null default false,
  temporary_playlist_id uuid references public.led_wall_playlists (id) on delete set null,
  default_slide_seconds integer not null default 12
    check (default_slide_seconds between 5 and 120),
  default_override_minutes integer not null default 5
    check (default_override_minutes between 1 and 120),
  max_upload_bytes integer not null default 10485760
    check (max_upload_bytes between 1048576 and 52428800),
  business_night_end_hour integer not null default 2
    check (business_night_end_hour between 0 and 6),
  staff_idle_seconds integer not null default 180
    check (staff_idle_seconds between 30 and 3600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists server_station_settings_set_updated_at on public.server_station_settings;
create trigger server_station_settings_set_updated_at
  before update on public.server_station_settings
  for each row execute function public.set_updated_at();

alter table public.server_station_settings enable row level security;
alter table public.server_station_settings force row level security;
revoke all on public.server_station_settings from anon, public, authenticated;
grant select on public.server_station_settings to authenticated;
grant insert, update on public.server_station_settings to authenticated;

drop policy if exists server_station_settings_select_member on public.server_station_settings;
create policy server_station_settings_select_member
  on public.server_station_settings for select to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists server_station_settings_write_admin on public.server_station_settings;
create policy server_station_settings_write_admin
  on public.server_station_settings for all to authenticated
  using (public.has_venue_role(venue_id, array['admin']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));

insert into public.server_station_settings (venue_id)
select id from public.venues
on conflict (venue_id) do nothing;

-- ---------------------------------------------------------------------------
-- Provisioned kiosk devices
-- ---------------------------------------------------------------------------
create table if not exists public.server_station_devices (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  label text not null default 'Server Station',
  token_hash text not null,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint server_station_devices_label_len check (char_length(label) between 1 and 80)
);

create unique index if not exists server_station_devices_token_hash_uidx
  on public.server_station_devices (token_hash)
  where revoked_at is null;

create index if not exists server_station_devices_venue_idx
  on public.server_station_devices (venue_id)
  where revoked_at is null;

drop trigger if exists server_station_devices_set_updated_at on public.server_station_devices;
create trigger server_station_devices_set_updated_at
  before update on public.server_station_devices
  for each row execute function public.set_updated_at();

alter table public.server_station_devices enable row level security;
alter table public.server_station_devices force row level security;
revoke all on public.server_station_devices from anon, public, authenticated;
grant select on public.server_station_devices to authenticated;
grant insert, update on public.server_station_devices to authenticated;

drop policy if exists server_station_devices_select_admin on public.server_station_devices;
create policy server_station_devices_select_admin
  on public.server_station_devices for select to authenticated
  using (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));

drop policy if exists server_station_devices_write_admin on public.server_station_devices;
create policy server_station_devices_write_admin
  on public.server_station_devices for all to authenticated
  using (public.has_venue_role(venue_id, array['admin']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));

-- Short-lived pairing codes for kiosk claim
create table if not exists public.server_station_pairing_codes (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  code_hash text not null,
  label text not null default 'Server Station',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists server_station_pairing_codes_lookup_idx
  on public.server_station_pairing_codes (venue_id, expires_at)
  where consumed_at is null;

alter table public.server_station_pairing_codes enable row level security;
alter table public.server_station_pairing_codes force row level security;
revoke all on public.server_station_pairing_codes from anon, public, authenticated;
grant select, insert, update on public.server_station_pairing_codes to authenticated;

drop policy if exists server_station_pairing_admin on public.server_station_pairing_codes;
create policy server_station_pairing_admin
  on public.server_station_pairing_codes for all to authenticated
  using (public.has_venue_role(venue_id, array['admin']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));

-- ---------------------------------------------------------------------------
-- Staff PINs (kiosk identity)
-- ---------------------------------------------------------------------------
create table if not exists public.server_station_pins (
  venue_id uuid not null references public.venues (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  pin_hash text not null,
  pin_salt text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (venue_id, user_id)
);

drop trigger if exists server_station_pins_set_updated_at on public.server_station_pins;
create trigger server_station_pins_set_updated_at
  before update on public.server_station_pins
  for each row execute function public.set_updated_at();

alter table public.server_station_pins enable row level security;
alter table public.server_station_pins force row level security;
revoke all on public.server_station_pins from anon, public, authenticated;
grant select, insert, update, delete on public.server_station_pins to authenticated;

drop policy if exists server_station_pins_admin on public.server_station_pins;
create policy server_station_pins_admin
  on public.server_station_pins for all to authenticated
  using (public.has_venue_role(venue_id, array['admin']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));

-- ---------------------------------------------------------------------------
-- Temporary Server Station LED content
-- ---------------------------------------------------------------------------
create table if not exists public.led_server_items (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  kind text not null check (kind in ('food_special', 'drink_special', 'birthday', 'celebration', 'message', 'upload')),
  title text not null,
  subtitle text,
  template_id text not null default 'classic',
  status text not null default 'active'
    check (status in ('queued', 'active', 'expired', 'removed', 'pending_approval')),
  scene_id uuid references public.led_wall_scenes (id) on delete set null,
  playlist_item_id uuid references public.led_wall_playlist_items (id) on delete set null,
  thumbnail_url text,
  public_url text,
  storage_path text,
  content_hash text,
  created_by uuid references auth.users (id) on delete set null,
  created_by_name text,
  device_id uuid references public.server_station_devices (id) on delete set null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  show_now boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint led_server_items_title_len check (char_length(title) between 1 and 120),
  constraint led_server_items_ends_after_starts check (ends_at > starts_at)
);

create index if not exists led_server_items_active_idx
  on public.led_server_items (venue_id, ends_at)
  where status in ('active', 'queued', 'pending_approval');

drop trigger if exists led_server_items_set_updated_at on public.led_server_items;
create trigger led_server_items_set_updated_at
  before update on public.led_server_items
  for each row execute function public.set_updated_at();

alter table public.led_server_items enable row level security;
alter table public.led_server_items force row level security;
revoke all on public.led_server_items from anon, public, authenticated;
grant select, insert, update on public.led_server_items to authenticated;

drop policy if exists led_server_items_select_member on public.led_server_items;
create policy led_server_items_select_member
  on public.led_server_items for select to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists led_server_items_insert_ops on public.led_server_items;
create policy led_server_items_insert_ops
  on public.led_server_items for insert to authenticated
  with check (
    public.has_venue_role(
      venue_id,
      array['admin', 'manager', 'server']::public.staff_role[]
    )
  );

drop policy if exists led_server_items_update_ops on public.led_server_items;
create policy led_server_items_update_ops
  on public.led_server_items for update to authenticated
  using (
    public.has_venue_role(
      venue_id,
      array['admin', 'manager', 'server']::public.staff_role[]
    )
  )
  with check (
    public.has_venue_role(
      venue_id,
      array['admin', 'manager', 'server']::public.staff_role[]
    )
  );

-- ---------------------------------------------------------------------------
-- Timed LED override (Show Now)
-- ---------------------------------------------------------------------------
create table if not exists public.led_wall_overrides (
  venue_id uuid primary key references public.venues (id) on delete cascade,
  scene_id uuid not null references public.led_wall_scenes (id) on delete cascade,
  server_item_id uuid references public.led_server_items (id) on delete set null,
  ends_at timestamptz not null,
  previous_scene_id uuid,
  previous_playlist_id uuid,
  previous_activation_source text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint led_wall_overrides_ends_future check (ends_at > created_at)
);

drop trigger if exists led_wall_overrides_set_updated_at on public.led_wall_overrides;
create trigger led_wall_overrides_set_updated_at
  before update on public.led_wall_overrides
  for each row execute function public.set_updated_at();

create or replace view public.led_wall_override_listings
with (security_invoker = false)
as
select
  o.venue_id,
  o.scene_id,
  o.server_item_id,
  o.ends_at,
  o.updated_at,
  s.title,
  s.kind,
  s.media_kind,
  s.public_url,
  s.obs_scene_name,
  coalesce(s.duration_seconds, 15) as duration_seconds
from public.led_wall_overrides o
join public.led_wall_scenes s on s.id = o.scene_id
where s.archived_at is null
  and s.enabled = true
  and o.ends_at > now();

alter table public.led_wall_overrides enable row level security;
alter table public.led_wall_overrides force row level security;
revoke all on public.led_wall_overrides from anon, public, authenticated;
revoke all on public.led_wall_override_listings from anon, public, authenticated;
grant select, insert, update, delete on public.led_wall_overrides to authenticated;
grant select on public.led_wall_override_listings to anon, authenticated;

drop policy if exists led_wall_overrides_select_member on public.led_wall_overrides;
create policy led_wall_overrides_select_member
  on public.led_wall_overrides for select to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists led_wall_overrides_write_ops on public.led_wall_overrides;
create policy led_wall_overrides_write_ops
  on public.led_wall_overrides for all to authenticated
  using (
    public.has_venue_role(
      venue_id,
      array['admin', 'manager', 'server']::public.staff_role[]
    )
  )
  with check (
    public.has_venue_role(
      venue_id,
      array['admin', 'manager', 'server']::public.staff_role[]
    )
  );

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------
create table if not exists public.server_station_audit_log (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  actor_user_id uuid,
  actor_name text,
  device_id uuid,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists server_station_audit_log_venue_idx
  on public.server_station_audit_log (venue_id, created_at desc);

alter table public.server_station_audit_log enable row level security;
alter table public.server_station_audit_log force row level security;
revoke all on public.server_station_audit_log from anon, public, authenticated;
grant select, insert on public.server_station_audit_log to authenticated;

drop policy if exists server_station_audit_select_admin on public.server_station_audit_log;
create policy server_station_audit_select_admin
  on public.server_station_audit_log for select to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

drop policy if exists server_station_audit_insert_ops on public.server_station_audit_log;
create policy server_station_audit_insert_ops
  on public.server_station_audit_log for insert to authenticated
  with check (
    public.has_venue_role(
      venue_id,
      array['admin', 'manager', 'server']::public.staff_role[]
    )
  );

-- ---------------------------------------------------------------------------
-- Phone upload sessions scoped to Server Station workflows
-- ---------------------------------------------------------------------------
create table if not exists public.server_station_upload_sessions (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  device_id uuid references public.server_station_devices (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  workflow text not null default 'upload'
    check (workflow in ('upload', 'special', 'birthday', 'message')),
  token_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  uploaded_url text,
  uploaded_storage_path text,
  uploaded_media_kind text,
  uploaded_content_hash text,
  uploaded_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists server_station_upload_sessions_token_uidx
  on public.server_station_upload_sessions (token_hash);

create index if not exists server_station_upload_sessions_open_idx
  on public.server_station_upload_sessions (venue_id, expires_at)
  where consumed_at is null;

alter table public.server_station_upload_sessions enable row level security;
alter table public.server_station_upload_sessions force row level security;
revoke all on public.server_station_upload_sessions from anon, public, authenticated;
grant select, insert, update on public.server_station_upload_sessions to authenticated;

drop policy if exists server_station_upload_sessions_ops on public.server_station_upload_sessions;
create policy server_station_upload_sessions_ops
  on public.server_station_upload_sessions for all to authenticated
  using (
    public.has_venue_role(
      venue_id,
      array['admin', 'manager', 'server']::public.staff_role[]
    )
  )
  with check (
    public.has_venue_role(
      venue_id,
      array['admin', 'manager', 'server']::public.staff_role[]
    )
  );

notify pgrst, 'reload schema';
