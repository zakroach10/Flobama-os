-- Publish curated Performance Library sessions to Server Station for floor staff.

alter table public.performance_recordings
  add column if not exists server_station_published boolean not null default false,
  add column if not exists server_station_title text
    check (
      server_station_title is null
      or char_length(btrim(server_station_title)) between 1 and 120
    ),
  add column if not exists server_station_sort_order integer not null default 0,
  add column if not exists server_station_published_at timestamptz,
  add column if not exists server_station_published_by uuid references auth.users (id) on delete set null;

create index if not exists performance_recordings_server_station_idx
  on public.performance_recordings (venue_id, server_station_sort_order, parsed_timestamp desc nulls last)
  where server_station_published = true;

comment on column public.performance_recordings.server_station_published is
  'When true, floor staff can play this session from Server Station.';

comment on column public.performance_recordings.server_station_title is
  'Optional short label for Server Station (source filename unchanged). Falls back to display_title.';

notify pgrst, 'reload schema';
