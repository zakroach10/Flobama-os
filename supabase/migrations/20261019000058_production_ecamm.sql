-- FloBama Production: Ecamm Live control, sessions, markers, commands, device role.

-- ---------------------------------------------------------------------------
-- Display device kind: production Mac (distinct from LED wall runner)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'production_runner'
      and enumtypid = 'public.display_device_kind'::regtype
  ) then
    alter type public.display_device_kind add value 'production_runner';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Staff menus: add production
-- ---------------------------------------------------------------------------
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
      'production',
      'ticketing',
      'spoton',
      'artists',
      'settings',
      'server'
    ]::text[]
  );

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'production_command_status') then
    create type public.production_command_status as enum (
      'pending',
      'queued',
      'sent',
      'acknowledged',
      'confirmed',
      'failed',
      'expired',
      'uncertain',
      'rejected'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'production_session_status') then
    create type public.production_session_status as enum (
      'planned',
      'live',
      'recording',
      'paused',
      'ended',
      'unassigned'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'production_marker_ecamm_status') then
    create type public.production_marker_ecamm_status as enum (
      'not_sent',
      'queued',
      'sent',
      'acknowledged',
      'failed',
      'unknown'
    );
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Venue production settings
-- ---------------------------------------------------------------------------
create table if not exists public.production_settings (
  venue_id uuid primary key references public.venues (id) on delete cascade,
  production_device_id uuid references public.display_devices (id) on delete set null,
  allow_per_bus_mute boolean not null default false,
  scene_favorites jsonb not null default '[]'::jsonb,
  overlay_favorites jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

drop trigger if exists production_settings_set_updated_at on public.production_settings;
create trigger production_settings_set_updated_at
  before update on public.production_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Cached Ecamm device status (change-detected; not every poll snapshot)
-- ---------------------------------------------------------------------------
create table if not exists public.production_device_status (
  device_id uuid primary key references public.display_devices (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  connection_phase text not null default 'offline',
  approval_permission text,
  ecamm_host text,
  ecamm_hostname text,
  ecamm_service_name text,
  runner_version text,
  ecamm_client_uuid text,
  current_scene_id text,
  current_scene_label text,
  button_label text,
  pause_button_label text,
  broadcast_inference text,
  broadcast_inference_source text,
  viewers integer,
  preview_mode boolean,
  zoom_in_meeting boolean,
  last_success_at timestamptz,
  last_error text,
  endpoint_status jsonb not null default '{}'::jsonb,
  state_fingerprint text,
  raw_info_unmapped jsonb not null default '[]'::jsonb,
  reported_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists production_device_status_venue_idx
  on public.production_device_status (venue_id, reported_at desc);

drop trigger if exists production_device_status_set_updated_at on public.production_device_status;
create trigger production_device_status_set_updated_at
  before update on public.production_device_status
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Production sessions (event/artist linked; may span midnight)
-- ---------------------------------------------------------------------------
create table if not exists public.production_sessions (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  device_id uuid references public.display_devices (id) on delete set null,
  event_id uuid references public.events (id) on delete set null,
  artist_ids uuid[] not null default '{}',
  status public.production_session_status not null default 'planned',
  title text,
  notes text,
  set_number integer check (set_number is null or set_number >= 1),
  started_at timestamptz,
  ended_at timestamptz,
  recording_started_at timestamptz,
  recording_ended_at timestamptz,
  ecamm_recording_path text,
  performance_recording_id text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or started_at is null or ended_at >= started_at)
);

create index if not exists production_sessions_venue_started_idx
  on public.production_sessions (venue_id, started_at desc nulls last);

create index if not exists production_sessions_venue_event_idx
  on public.production_sessions (venue_id, event_id)
  where event_id is not null;

create index if not exists production_sessions_venue_status_idx
  on public.production_sessions (venue_id, status);

drop trigger if exists production_sessions_set_updated_at on public.production_sessions;
create trigger production_sessions_set_updated_at
  before update on public.production_sessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Markers (OS record survives Ecamm rejection)
-- ---------------------------------------------------------------------------
create table if not exists public.production_markers (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  session_id uuid not null references public.production_sessions (id) on delete cascade,
  label text not null default 'Highlight' check (char_length(btrim(label)) between 1 and 200),
  notes text,
  marked_at timestamptz not null default now(),
  relative_seconds double precision,
  os_saved boolean not null default true,
  ecamm_status public.production_marker_ecamm_status not null default 'not_sent',
  ecamm_command_id uuid,
  ecamm_error text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists production_markers_session_idx
  on public.production_markers (session_id, marked_at);

create index if not exists production_markers_venue_idx
  on public.production_markers (venue_id, marked_at desc);

-- ---------------------------------------------------------------------------
-- Production commands (allowlisted; audited)
-- ---------------------------------------------------------------------------
create table if not exists public.production_commands (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  device_id uuid not null references public.display_devices (id) on delete cascade,
  kind text not null check (char_length(btrim(kind)) between 1 and 64),
  endpoint text,
  payload jsonb not null default '{}'::jsonb,
  status public.production_command_status not null default 'pending',
  result jsonb,
  reject_reason text,
  issued_by uuid references auth.users (id) on delete set null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  sent_at timestamptz,
  acknowledged_at timestamptz,
  completed_at timestamptz,
  dedupe_key text,
  created_at timestamptz not null default now()
);

create index if not exists production_commands_device_pending_idx
  on public.production_commands (device_id, status, issued_at)
  where status in ('pending', 'queued', 'sent');

create index if not exists production_commands_venue_idx
  on public.production_commands (venue_id, issued_at desc);

create unique index if not exists production_commands_dedupe_uidx
  on public.production_commands (venue_id, dedupe_key)
  where dedupe_key is not null and status in ('pending', 'queued', 'sent', 'acknowledged');

-- ---------------------------------------------------------------------------
-- Audit trail (not high-frequency poll snapshots)
-- ---------------------------------------------------------------------------
create table if not exists public.production_audit_log (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  device_id uuid references public.display_devices (id) on delete set null,
  session_id uuid references public.production_sessions (id) on delete set null,
  action text not null check (char_length(btrim(action)) between 1 and 80),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists production_audit_log_venue_idx
  on public.production_audit_log (venue_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Recording completion events (Shortcuts / folder reconcile; idempotent)
-- ---------------------------------------------------------------------------
create table if not exists public.production_recording_events (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  device_id uuid references public.display_devices (id) on delete set null,
  session_id uuid references public.production_sessions (id) on delete set null,
  event_type text not null check (event_type in (
    'recording_started',
    'recording_finished',
    'broadcast_started',
    'broadcast_finished'
  )),
  path_text text,
  path_validated boolean not null default false,
  idempotency_key text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (venue_id, idempotency_key)
);

create index if not exists production_recording_events_venue_idx
  on public.production_recording_events (venue_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.production_settings enable row level security;
alter table public.production_settings force row level security;
alter table public.production_device_status enable row level security;
alter table public.production_device_status force row level security;
alter table public.production_sessions enable row level security;
alter table public.production_sessions force row level security;
alter table public.production_markers enable row level security;
alter table public.production_markers force row level security;
alter table public.production_commands enable row level security;
alter table public.production_commands force row level security;
alter table public.production_audit_log enable row level security;
alter table public.production_audit_log force row level security;
alter table public.production_recording_events enable row level security;
alter table public.production_recording_events force row level security;

-- Members can read production data for their venue.
create policy production_settings_select on public.production_settings
  for select to authenticated
  using (public.is_venue_member(venue_id));

create policy production_device_status_select on public.production_device_status
  for select to authenticated
  using (public.is_venue_member(venue_id));

create policy production_sessions_select on public.production_sessions
  for select to authenticated
  using (public.is_venue_member(venue_id));

create policy production_markers_select on public.production_markers
  for select to authenticated
  using (public.is_venue_member(venue_id));

create policy production_commands_select on public.production_commands
  for select to authenticated
  using (public.is_venue_member(venue_id));

create policy production_audit_log_select on public.production_audit_log
  for select to authenticated
  using (public.is_venue_member(venue_id));

create policy production_recording_events_select on public.production_recording_events
  for select to authenticated
  using (public.is_venue_member(venue_id));

-- Admin/manager write sessions + markers via authenticated client when needed;
-- privileged writes primarily use service role from server actions.
create policy production_sessions_write_staff on public.production_sessions
  for all to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

create policy production_markers_write_staff on public.production_markers
  for all to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

create policy production_settings_write_admin on public.production_settings
  for all to authenticated
  using (public.has_venue_role(venue_id, array['admin']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));
