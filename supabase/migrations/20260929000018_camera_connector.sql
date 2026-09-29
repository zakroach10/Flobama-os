-- FloBama Mac Connector: pairing, device credentials, cameras, control leases, commands, preview sessions.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'camera_protocol') then
    create type public.camera_protocol as enum ('simulated', 'ndi_ptz', 'visca_udp', 'visca_tcp', 'unknown');
  end if;
  if not exists (select 1 from pg_type where typname = 'camera_command_kind') then
    create type public.camera_command_kind as enum (
      'ptz_move',
      'ptz_stop',
      'ptz_zoom',
      'ptz_preset_recall',
      'ptz_preset_save',
      'ptz_focus'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'camera_command_status') then
    create type public.camera_command_status as enum ('pending', 'accepted', 'rejected', 'expired', 'completed');
  end if;
  if not exists (select 1 from pg_type where typname = 'camera_preview_mode') then
    create type public.camera_preview_mode as enum ('snapshot', 'webrtc');
  end if;
end
$$;

create table if not exists public.camera_connector_pairing_codes (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  code_hash text not null check (char_length(code_hash) = 64),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists camera_connector_pairing_codes_venue_idx
  on public.camera_connector_pairing_codes (venue_id, expires_at desc);

create table if not exists public.camera_connector_devices (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  label text not null default 'FloBama Mac' check (char_length(btrim(label)) between 1 and 120),
  token_hash text not null check (char_length(token_hash) = 64),
  revoked_at timestamptz,
  remote_control_enabled boolean not null default true,
  last_seen_at timestamptz,
  connector_version text,
  hostname text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists camera_connector_devices_token_hash_uidx
  on public.camera_connector_devices (token_hash)
  where revoked_at is null;

drop trigger if exists camera_connector_devices_set_updated_at on public.camera_connector_devices;
create trigger camera_connector_devices_set_updated_at
  before update on public.camera_connector_devices
  for each row execute function public.set_updated_at();

create table if not exists public.camera_sources (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  device_id uuid not null references public.camera_connector_devices (id) on delete cascade,
  source_key text not null check (char_length(btrim(source_key)) between 1 and 200),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  protocol public.camera_protocol not null default 'unknown',
  is_simulated boolean not null default false,
  is_program_output boolean not null default false,
  supports_ptz boolean not null default false,
  supports_zoom boolean not null default false,
  supports_presets boolean not null default false,
  supports_preset_save boolean not null default false,
  supports_focus boolean not null default false,
  online boolean not null default false,
  last_error text,
  sort_order integer not null default 0,
  capabilities jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (device_id, source_key)
);

create index if not exists camera_sources_venue_idx
  on public.camera_sources (venue_id, sort_order);

drop trigger if exists camera_sources_set_updated_at on public.camera_sources;
create trigger camera_sources_set_updated_at
  before update on public.camera_sources
  for each row execute function public.set_updated_at();

create table if not exists public.camera_control_leases (
  camera_id uuid primary key references public.camera_sources (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  holder_user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists camera_control_leases_set_updated_at on public.camera_control_leases;
create trigger camera_control_leases_set_updated_at
  before update on public.camera_control_leases
  for each row execute function public.set_updated_at();

create table if not exists public.camera_commands (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  camera_id uuid not null references public.camera_sources (id) on delete cascade,
  device_id uuid not null references public.camera_connector_devices (id) on delete cascade,
  kind public.camera_command_kind not null,
  payload jsonb not null default '{}'::jsonb,
  status public.camera_command_status not null default 'pending',
  issued_by uuid references auth.users (id) on delete set null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  completed_at timestamptz,
  reject_reason text
);

create index if not exists camera_commands_pending_idx
  on public.camera_commands (device_id, status, expires_at)
  where status = 'pending';

create table if not exists public.camera_preview_sessions (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  camera_id uuid not null references public.camera_sources (id) on delete cascade,
  device_id uuid not null references public.camera_connector_devices (id) on delete cascade,
  requester_user_id uuid not null references auth.users (id) on delete cascade,
  mode public.camera_preview_mode not null default 'snapshot',
  status text not null default 'requested' check (status in ('requested', 'active', 'ended', 'failed')),
  offer_sdp text,
  answer_sdp text,
  ice_trickle jsonb not null default '[]'::jsonb,
  snapshot_path text,
  snapshot_url text,
  snapshot_updated_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists camera_preview_sessions_set_updated_at on public.camera_preview_sessions;
create trigger camera_preview_sessions_set_updated_at
  before update on public.camera_preview_sessions
  for each row execute function public.set_updated_at();

create table if not exists public.camera_audit_log (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  device_id uuid references public.camera_connector_devices (id) on delete set null,
  camera_id uuid references public.camera_sources (id) on delete set null,
  action text not null check (char_length(btrim(action)) between 1 and 80),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists camera_audit_log_venue_idx
  on public.camera_audit_log (venue_id, created_at desc);

-- RLS: secrets opaque to staff clients (service role only). Staff see devices/sources/leases/commands they need.
alter table public.camera_connector_pairing_codes enable row level security;
alter table public.camera_connector_pairing_codes force row level security;
alter table public.camera_connector_devices enable row level security;
alter table public.camera_connector_devices force row level security;
alter table public.camera_sources enable row level security;
alter table public.camera_sources force row level security;
alter table public.camera_control_leases enable row level security;
alter table public.camera_control_leases force row level security;
alter table public.camera_commands enable row level security;
alter table public.camera_commands force row level security;
alter table public.camera_preview_sessions enable row level security;
alter table public.camera_preview_sessions force row level security;
alter table public.camera_audit_log enable row level security;
alter table public.camera_audit_log force row level security;

revoke all on public.camera_connector_pairing_codes from anon, public, authenticated;
revoke all on public.camera_connector_devices from anon, public, authenticated;
revoke all on public.camera_sources from anon, public, authenticated;
revoke all on public.camera_control_leases from anon, public, authenticated;
revoke all on public.camera_commands from anon, public, authenticated;
revoke all on public.camera_preview_sessions from anon, public, authenticated;
revoke all on public.camera_audit_log from anon, public, authenticated;

-- Pairing codes: admins can insert/select metadata (not used for exchange — service role consumes).
grant select, insert on public.camera_connector_pairing_codes to authenticated;
grant select, update on public.camera_connector_devices to authenticated;
grant select on public.camera_sources to authenticated;
grant select, insert, update, delete on public.camera_control_leases to authenticated;
grant select, insert on public.camera_commands to authenticated;
grant select, insert, update on public.camera_preview_sessions to authenticated;
grant select, insert on public.camera_audit_log to authenticated;

drop policy if exists camera_pairing_select_admin on public.camera_connector_pairing_codes;
create policy camera_pairing_select_admin
  on public.camera_connector_pairing_codes for select to authenticated
  using (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));

drop policy if exists camera_pairing_insert_admin on public.camera_connector_pairing_codes;
create policy camera_pairing_insert_admin
  on public.camera_connector_pairing_codes for insert to authenticated
  with check (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));

drop policy if exists camera_devices_select_member on public.camera_connector_devices;
create policy camera_devices_select_member
  on public.camera_connector_devices for select to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists camera_devices_update_admin on public.camera_connector_devices;
create policy camera_devices_update_admin
  on public.camera_connector_devices for update to authenticated
  using (public.has_venue_role(venue_id, array['admin']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));

drop policy if exists camera_sources_select_member on public.camera_sources;
create policy camera_sources_select_member
  on public.camera_sources for select to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists camera_leases_select_member on public.camera_control_leases;
create policy camera_leases_select_member
  on public.camera_control_leases for select to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists camera_leases_write_member on public.camera_control_leases;
create policy camera_leases_write_member
  on public.camera_control_leases for all to authenticated
  using (public.is_venue_member(venue_id))
  with check (public.is_venue_member(venue_id));

drop policy if exists camera_commands_select_member on public.camera_commands;
create policy camera_commands_select_member
  on public.camera_commands for select to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists camera_commands_insert_member on public.camera_commands;
create policy camera_commands_insert_member
  on public.camera_commands for insert to authenticated
  with check (public.is_venue_member(venue_id));

drop policy if exists camera_preview_select_member on public.camera_preview_sessions;
create policy camera_preview_select_member
  on public.camera_preview_sessions for select to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists camera_preview_write_member on public.camera_preview_sessions;
create policy camera_preview_write_member
  on public.camera_preview_sessions for all to authenticated
  using (public.is_venue_member(venue_id))
  with check (public.is_venue_member(venue_id));

drop policy if exists camera_audit_select_admin on public.camera_audit_log;
create policy camera_audit_select_admin
  on public.camera_audit_log for select to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

drop policy if exists camera_audit_insert_member on public.camera_audit_log;
create policy camera_audit_insert_member
  on public.camera_audit_log for insert to authenticated
  with check (public.is_venue_member(venue_id));

-- Private preview snapshots; served only through authenticated media routes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('camera-previews', 'camera-previews', false, 2_000_000, array['image/jpeg', 'image/png']::text[])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';
