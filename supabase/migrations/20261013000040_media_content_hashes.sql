-- Content hashes for screen media so display devices can cache by sha256.

create table if not exists public.media_content_hashes (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  asset_kind text not null check (asset_kind in ('screen_ad', 'led_scene', 'menu_special', 'audience_asset')),
  asset_id uuid not null,
  storage_path text not null check (char_length(btrim(storage_path)) between 1 and 500),
  sha256 text check (sha256 is null or char_length(sha256) = 64),
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  media_type text check (media_type is null or char_length(btrim(media_type)) between 1 and 120),
  computed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (asset_kind, asset_id)
);

create index if not exists media_content_hashes_venue_idx
  on public.media_content_hashes (venue_id, asset_kind);

create index if not exists media_content_hashes_sha256_idx
  on public.media_content_hashes (sha256)
  where sha256 is not null;

create unique index if not exists media_content_hashes_storage_path_uidx
  on public.media_content_hashes (venue_id, storage_path);

drop trigger if exists media_content_hashes_set_updated_at on public.media_content_hashes;
create trigger media_content_hashes_set_updated_at
  before update on public.media_content_hashes
  for each row execute function public.set_updated_at();

alter table public.media_content_hashes enable row level security;
alter table public.media_content_hashes force row level security;

revoke all on public.media_content_hashes from anon, public, authenticated;
grant select, insert, update on public.media_content_hashes to authenticated;

drop policy if exists media_content_hashes_select_member on public.media_content_hashes;
create policy media_content_hashes_select_member
  on public.media_content_hashes for select to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists media_content_hashes_write_manager on public.media_content_hashes;
create policy media_content_hashes_write_manager
  on public.media_content_hashes for all to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

notify pgrst, 'reload schema';
