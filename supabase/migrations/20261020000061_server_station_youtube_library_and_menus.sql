-- Server Station: YouTube QR link sessions, recent/favorites library,
-- and admin toggles for which menus/features appear on the kiosk.

-- ---------------------------------------------------------------------------
-- Menu / feature flags (admin Settings → Server Station)
-- ---------------------------------------------------------------------------
alter table public.server_station_settings
  add column if not exists menus_enabled jsonb not null default '{
    "events": true,
    "wall": true,
    "performances": true,
    "specials": true,
    "birthday": true,
    "message": true,
    "upload": true,
    "youtube": true,
    "active": true
  }'::jsonb;

alter table public.server_station_settings
  drop constraint if exists server_station_settings_menus_enabled_object;

alter table public.server_station_settings
  add constraint server_station_settings_menus_enabled_object
  check (jsonb_typeof(menus_enabled) = 'object');

-- ---------------------------------------------------------------------------
-- YouTube recent + favorites (one row per venue video)
-- ---------------------------------------------------------------------------
create table if not exists public.server_station_youtube_videos (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  video_id text not null
    check (char_length(video_id) between 6 and 20),
  watch_url text not null
    check (char_length(watch_url) between 12 and 800),
  title text not null
    check (char_length(btrim(title)) between 1 and 160),
  thumbnail_url text
    check (thumbnail_url is null or char_length(thumbnail_url) between 12 and 800),
  is_favorite boolean not null default false,
  play_count integer not null default 0 check (play_count >= 0),
  last_played_at timestamptz,
  favorited_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint server_station_youtube_videos_venue_video unique (venue_id, video_id)
);

create index if not exists server_station_youtube_videos_recent_idx
  on public.server_station_youtube_videos (venue_id, last_played_at desc nulls last);

create index if not exists server_station_youtube_videos_favorites_idx
  on public.server_station_youtube_videos (venue_id, favorited_at desc nulls last)
  where is_favorite = true;

drop trigger if exists server_station_youtube_videos_set_updated_at
  on public.server_station_youtube_videos;
create trigger server_station_youtube_videos_set_updated_at
  before update on public.server_station_youtube_videos
  for each row execute function public.set_updated_at();

alter table public.server_station_youtube_videos enable row level security;
alter table public.server_station_youtube_videos force row level security;
revoke all on public.server_station_youtube_videos from anon, public, authenticated;
grant select, insert, update, delete on public.server_station_youtube_videos to authenticated;

drop policy if exists server_station_youtube_videos_ops on public.server_station_youtube_videos;
create policy server_station_youtube_videos_ops
  on public.server_station_youtube_videos for all to authenticated
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
-- Phone QR sessions: allow youtube workflow + submitted link fields
-- ---------------------------------------------------------------------------
alter table public.server_station_upload_sessions
  drop constraint if exists server_station_upload_sessions_workflow_check;

alter table public.server_station_upload_sessions
  add constraint server_station_upload_sessions_workflow_check
  check (workflow in ('upload', 'special', 'birthday', 'message', 'youtube'));

alter table public.server_station_upload_sessions
  add column if not exists submitted_youtube_url text
    check (submitted_youtube_url is null or char_length(submitted_youtube_url) between 12 and 800);

alter table public.server_station_upload_sessions
  add column if not exists submitted_youtube_video_id text
    check (submitted_youtube_video_id is null or char_length(submitted_youtube_video_id) between 6 and 20);

alter table public.server_station_upload_sessions
  add column if not exists submitted_youtube_title text
    check (submitted_youtube_title is null or char_length(submitted_youtube_title) between 1 and 160);
