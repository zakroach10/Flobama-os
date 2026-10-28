-- Temporary library for Server Station phone QR uploads.
-- Uploads land here first so staff can Set on Wall (takeover) instead of
-- only dumping them into the house ad rotation.

create table if not exists public.server_station_upload_library (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  title text not null
    check (char_length(btrim(title)) between 1 and 120),
  public_url text not null
    check (char_length(public_url) between 12 and 800),
  storage_path text not null
    check (char_length(storage_path) between 4 and 400),
  media_kind text not null default 'image'
    check (media_kind in ('image', 'video')),
  content_hash text
    check (content_hash is null or char_length(content_hash) between 8 and 128),
  template_id text not null default 'classic'
    check (char_length(template_id) between 1 and 40),
  upload_session_id uuid references public.server_station_upload_sessions (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_by_name text,
  device_id uuid references public.server_station_devices (id) on delete set null,
  ends_at timestamptz not null,
  last_set_on_wall_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint server_station_upload_library_ends_after_created check (ends_at > created_at)
);

create index if not exists server_station_upload_library_active_idx
  on public.server_station_upload_library (venue_id, created_at desc)
  where removed_at is null;

create unique index if not exists server_station_upload_library_session_uidx
  on public.server_station_upload_library (upload_session_id)
  where upload_session_id is not null;

drop trigger if exists server_station_upload_library_set_updated_at
  on public.server_station_upload_library;
create trigger server_station_upload_library_set_updated_at
  before update on public.server_station_upload_library
  for each row execute function public.set_updated_at();

alter table public.server_station_upload_library enable row level security;
alter table public.server_station_upload_library force row level security;
revoke all on public.server_station_upload_library from anon, public, authenticated;
grant select, insert, update, delete on public.server_station_upload_library to authenticated;

drop policy if exists server_station_upload_library_ops on public.server_station_upload_library;
create policy server_station_upload_library_ops
  on public.server_station_upload_library for all to authenticated
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
