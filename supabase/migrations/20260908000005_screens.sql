-- LED wall OBS mapping and vertical ad playlist.
-- Anonymous role cannot read screen_ads or screen_wall_state.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'screen_wall_mode') then
    create type public.screen_wall_mode as enum ('auto', 'manual');
  end if;
  if not exists (select 1 from pg_type where typname = 'screen_media_kind') then
    create type public.screen_media_kind as enum ('image', 'video');
  end if;
  if not exists (select 1 from pg_type where typname = 'screen_transition') then
    create type public.screen_transition as enum ('cut', 'fade', 'slide');
  end if;
end
$$;

create table if not exists public.screen_wall_state (
  venue_id uuid primary key references public.venues (id) on delete cascade,
  mode public.screen_wall_mode not null default 'auto',
  ads_scene_name text check (ads_scene_name is null or char_length(ads_scene_name) between 1 and 200),
  band_scene_name text check (band_scene_name is null or char_length(band_scene_name) between 1 and 200),
  manual_scene_name text check (manual_scene_name is null or char_length(manual_scene_name) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists screen_wall_state_set_updated_at on public.screen_wall_state;
create trigger screen_wall_state_set_updated_at
  before update on public.screen_wall_state
  for each row execute function public.set_updated_at();

create table if not exists public.screen_ads (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  storage_path text not null check (char_length(storage_path) between 1 and 500),
  public_url text not null check (char_length(public_url) between 1 and 800),
  media_kind public.screen_media_kind not null,
  duration_seconds integer check (duration_seconds is null or duration_seconds between 1 and 600),
  transition public.screen_transition not null default 'fade',
  sort_order integer not null default 0 check (sort_order >= 0),
  enabled boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.screen_ads
  drop constraint if exists screen_ads_image_duration_required;
alter table public.screen_ads
  add constraint screen_ads_image_duration_required
  check (media_kind <> 'image' or duration_seconds is not null);

create index if not exists screen_ads_venue_order_idx
  on public.screen_ads (venue_id, sort_order)
  where archived_at is null;

drop trigger if exists screen_ads_set_updated_at on public.screen_ads;
create trigger screen_ads_set_updated_at
  before update on public.screen_ads
  for each row execute function public.set_updated_at();

create or replace view public.screen_ad_listings
with (security_invoker = false)
as
select
  a.id,
  a.venue_id,
  a.title,
  a.public_url,
  a.media_kind,
  a.duration_seconds,
  a.transition,
  a.sort_order
from public.screen_ads a
where a.enabled = true
  and a.archived_at is null;

alter table public.screen_wall_state enable row level security;
alter table public.screen_wall_state force row level security;
alter table public.screen_ads enable row level security;
alter table public.screen_ads force row level security;

revoke all on public.screen_wall_state from anon, public, authenticated;
revoke all on public.screen_ads from anon, public, authenticated;
revoke all on public.screen_ad_listings from anon, public, authenticated;

grant select, insert, update on public.screen_wall_state to authenticated;
grant select, insert, update on public.screen_ads to authenticated;
grant select on public.screen_ad_listings to anon, authenticated;

drop policy if exists screen_wall_state_select_member on public.screen_wall_state;
create policy screen_wall_state_select_member
  on public.screen_wall_state
  for select
  to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists screen_wall_state_insert_managers on public.screen_wall_state;
create policy screen_wall_state_insert_managers
  on public.screen_wall_state
  for insert
  to authenticated
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

drop policy if exists screen_wall_state_update_managers on public.screen_wall_state;
create policy screen_wall_state_update_managers
  on public.screen_wall_state
  for update
  to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

drop policy if exists screen_ads_select_member on public.screen_ads;
create policy screen_ads_select_member
  on public.screen_ads
  for select
  to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists screen_ads_insert_managers on public.screen_ads;
create policy screen_ads_insert_managers
  on public.screen_ads
  for insert
  to authenticated
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

drop policy if exists screen_ads_update_managers on public.screen_ads;
create policy screen_ads_update_managers
  on public.screen_ads
  for update
  to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

insert into storage.buckets (id, name, public, file_size_limit)
values ('screen-ads', 'screen-ads', true, 52428800)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

drop policy if exists screen_ads_objects_select on storage.objects;
create policy screen_ads_objects_select
  on storage.objects
  for select
  to public
  using (bucket_id = 'screen-ads');

drop policy if exists screen_ads_objects_insert on storage.objects;
create policy screen_ads_objects_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'screen-ads'
    and public.has_venue_role(
      (split_part(name, '/', 1))::uuid,
      array['admin', 'manager']::public.staff_role[]
    )
  );

drop policy if exists screen_ads_objects_update on storage.objects;
create policy screen_ads_objects_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'screen-ads'
    and public.has_venue_role(
      (split_part(name, '/', 1))::uuid,
      array['admin', 'manager']::public.staff_role[]
    )
  )
  with check (
    bucket_id = 'screen-ads'
    and public.has_venue_role(
      (split_part(name, '/', 1))::uuid,
      array['admin', 'manager']::public.staff_role[]
    )
  );

drop policy if exists screen_ads_objects_delete on storage.objects;
create policy screen_ads_objects_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'screen-ads'
    and public.has_venue_role(
      (split_part(name, '/', 1))::uuid,
      array['admin', 'manager']::public.staff_role[]
    )
  );

notify pgrst, 'reload schema';
