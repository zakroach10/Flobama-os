-- FloBama Performance Library: Dropbox recordings catalog, event matches, queue, and device commands.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'performance_availability') then
    create type public.performance_availability as enum (
      'metadata-only',
      'needs download',
      'preparing',
      'ready',
      'unsupported',
      'missing',
      'error'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'performance_match_status') then
    create type public.performance_match_status as enum (
      'matched',
      'needs_review',
      'unmatched',
      'manual'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'performance_command_status') then
    create type public.performance_command_status as enum (
      'pending',
      'accepted',
      'rejected',
      'expired',
      'completed'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'performance_command_kind') then
    create type public.performance_command_kind as enum (
      'scan_recordings',
      'set_recordings_root',
      'prepare_recording',
      'play_now',
      'play_next',
      'queue_add',
      'queue_remove',
      'queue_reorder',
      'pause',
      'resume',
      'seek',
      'skip',
      'set_audio_muted',
      'stop_return_normal'
    );
  end if;
end
$$;

create table if not exists public.performance_library_settings (
  venue_id uuid primary key references public.venues (id) on delete cascade,
  device_id uuid references public.display_devices (id) on delete set null,
  recordings_root text,
  default_timezone text not null default 'America/Chicago',
  last_scan_at timestamptz,
  last_catalog_sync_at timestamptz,
  catalog_count integer not null default 0 check (catalog_count >= 0),
  scan_stats jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

drop trigger if exists performance_library_settings_set_updated_at on public.performance_library_settings;
create trigger performance_library_settings_set_updated_at
  before update on public.performance_library_settings
  for each row execute function public.set_updated_at();

create table if not exists public.performance_recordings (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  source_device_id uuid references public.display_devices (id) on delete set null,
  recording_id text not null check (char_length(btrim(recording_id)) between 8 and 64),
  original_filename text not null,
  relative_path text not null,
  file_size bigint,
  birthtime_ms bigint,
  mtime_ms bigint,
  parsed_timestamp timestamptz,
  raw_timestamp_text text,
  timezone text,
  parse_source text,
  parse_confidence text,
  duration_seconds double precision,
  container text,
  video_codec text,
  audio_codec text,
  width integer,
  height integer,
  has_audio boolean,
  availability public.performance_availability not null default 'metadata-only',
  playback_compatible boolean,
  needs_conversion boolean not null default false,
  last_scan_at timestamptz,
  last_error text,
  display_title text,
  display_title_locked boolean not null default false,
  match_status public.performance_match_status not null default 'unmatched',
  matched_event_id uuid references public.events (id) on delete set null,
  match_confidence text,
  match_reason text,
  match_locked boolean not null default false,
  suggested_event_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, recording_id)
);

create index if not exists performance_recordings_venue_match_idx
  on public.performance_recordings (venue_id, match_status, parsed_timestamp desc nulls last);

create index if not exists performance_recordings_venue_event_idx
  on public.performance_recordings (venue_id, matched_event_id)
  where matched_event_id is not null;

create index if not exists performance_recordings_search_idx
  on public.performance_recordings (venue_id, original_filename);

drop trigger if exists performance_recordings_set_updated_at on public.performance_recordings;
create trigger performance_recordings_set_updated_at
  before update on public.performance_recordings
  for each row execute function public.set_updated_at();

create table if not exists public.performance_queue_items (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  device_id uuid not null references public.display_devices (id) on delete cascade,
  recording_row_id uuid not null references public.performance_recordings (id) on delete cascade,
  recording_id text not null,
  display_title text,
  sort_order integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists performance_queue_items_device_idx
  on public.performance_queue_items (device_id, sort_order, created_at);

create table if not exists public.performance_playback_state (
  device_id uuid primary key references public.display_devices (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  mode text not null default 'normal' check (mode in ('normal', 'performance')),
  revision integer not null default 1,
  audio_muted boolean not null default true,
  now_playing_queue_item_id uuid,
  now_playing_recording_id text,
  now_playing_title text,
  position_seconds double precision,
  duration_seconds double precision,
  paused boolean not null default false,
  status text,
  prior_wall_revision text,
  last_error text,
  reported_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists performance_playback_state_set_updated_at on public.performance_playback_state;
create trigger performance_playback_state_set_updated_at
  before update on public.performance_playback_state
  for each row execute function public.set_updated_at();

create table if not exists public.performance_commands (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  device_id uuid not null references public.display_devices (id) on delete cascade,
  kind public.performance_command_kind not null,
  payload jsonb not null default '{}'::jsonb,
  status public.performance_command_status not null default 'pending',
  issued_by uuid references auth.users (id) on delete set null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  completed_at timestamptz,
  reject_reason text
);

create index if not exists performance_commands_pending_idx
  on public.performance_commands (device_id, status, expires_at)
  where status = 'pending';

alter table public.performance_library_settings enable row level security;
alter table public.performance_library_settings force row level security;
alter table public.performance_recordings enable row level security;
alter table public.performance_recordings force row level security;
alter table public.performance_queue_items enable row level security;
alter table public.performance_queue_items force row level security;
alter table public.performance_playback_state enable row level security;
alter table public.performance_playback_state force row level security;
alter table public.performance_commands enable row level security;
alter table public.performance_commands force row level security;

revoke all on public.performance_library_settings from anon, public, authenticated;
revoke all on public.performance_recordings from anon, public, authenticated;
revoke all on public.performance_queue_items from anon, public, authenticated;
revoke all on public.performance_playback_state from anon, public, authenticated;
revoke all on public.performance_commands from anon, public, authenticated;

grant select on public.performance_library_settings to authenticated;
grant select, update on public.performance_recordings to authenticated;
grant select, insert, update, delete on public.performance_queue_items to authenticated;
grant select on public.performance_playback_state to authenticated;
grant select, insert on public.performance_commands to authenticated;

drop policy if exists performance_settings_select_member on public.performance_library_settings;
create policy performance_settings_select_member
  on public.performance_library_settings for select to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists performance_settings_write_admin on public.performance_library_settings;
create policy performance_settings_write_admin
  on public.performance_library_settings for all to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

drop policy if exists performance_recordings_select_member on public.performance_recordings;
create policy performance_recordings_select_member
  on public.performance_recordings for select to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists performance_recordings_update_manager on public.performance_recordings;
create policy performance_recordings_update_manager
  on public.performance_recordings for update to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

drop policy if exists performance_queue_select_member on public.performance_queue_items;
create policy performance_queue_select_member
  on public.performance_queue_items for select to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists performance_queue_write_operator on public.performance_queue_items;
create policy performance_queue_write_operator
  on public.performance_queue_items for all to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

drop policy if exists performance_playback_select_member on public.performance_playback_state;
create policy performance_playback_select_member
  on public.performance_playback_state for select to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists performance_commands_select_member on public.performance_commands;
create policy performance_commands_select_member
  on public.performance_commands for select to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists performance_commands_insert_operator on public.performance_commands;
create policy performance_commands_insert_operator
  on public.performance_commands for insert to authenticated
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

notify pgrst, 'reload schema';
