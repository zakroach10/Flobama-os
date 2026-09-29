-- Named LED wall playlists that rotate scenes on the /display/led browser source.

create table if not exists public.led_wall_playlists (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists led_wall_playlists_venue_idx
  on public.led_wall_playlists (venue_id)
  where archived_at is null;

drop trigger if exists led_wall_playlists_set_updated_at on public.led_wall_playlists;
create trigger led_wall_playlists_set_updated_at
  before update on public.led_wall_playlists
  for each row execute function public.set_updated_at();

create table if not exists public.led_wall_playlist_items (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.led_wall_playlists (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  scene_id uuid not null references public.led_wall_scenes (id) on delete cascade,
  duration_seconds integer not null default 15 check (duration_seconds between 1 and 600),
  sort_order integer not null default 0 check (sort_order >= 0),
  enabled boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists led_wall_playlist_items_playlist_order_idx
  on public.led_wall_playlist_items (playlist_id, sort_order)
  where archived_at is null;

drop trigger if exists led_wall_playlist_items_set_updated_at on public.led_wall_playlist_items;
create trigger led_wall_playlist_items_set_updated_at
  before update on public.led_wall_playlist_items
  for each row execute function public.set_updated_at();

alter table public.led_wall_runtime
  add column if not exists active_playlist_id uuid references public.led_wall_playlists (id) on delete set null;

create or replace function public.led_wall_runtime_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.venue_id is distinct from old.venue_id then
      raise exception 'Venue cannot change.';
    end if;
  end if;

  if new.active_scene_id is not null then
    if not exists (
      select 1
      from public.led_wall_scenes s
      where s.id = new.active_scene_id
        and s.venue_id = new.venue_id
        and s.enabled = true
    ) then
      raise exception 'That scene is not available.';
    end if;
  end if;

  if new.active_playlist_id is not null then
    if not exists (
      select 1
      from public.led_wall_playlists p
      where p.id = new.active_playlist_id
        and p.venue_id = new.venue_id
        and p.archived_at is null
    ) then
      raise exception 'That playlist is not available.';
    end if;
  end if;

  if tg_op = 'INSERT' then
    new.activated_by := auth.uid();
    new.activated_at := now();
  elsif new.active_scene_id is distinct from old.active_scene_id
     or new.active_playlist_id is distinct from old.active_playlist_id then
    new.activated_by := auth.uid();
    new.activated_at := now();
  end if;

  return new;
end;
$$;

create or replace view public.led_wall_active_playlist_listings
with (security_invoker = false)
as
select
  i.id,
  i.venue_id,
  i.playlist_id,
  i.scene_id,
  i.duration_seconds,
  i.sort_order,
  s.title,
  s.kind,
  s.media_kind,
  s.public_url,
  s.obs_scene_name,
  r.activated_at
from public.led_wall_runtime r
join public.led_wall_playlists p
  on p.id = r.active_playlist_id
 and p.archived_at is null
join public.led_wall_playlist_items i
  on i.playlist_id = p.id
 and i.venue_id = r.venue_id
 and i.enabled = true
 and i.archived_at is null
join public.led_wall_scenes s
  on s.id = i.scene_id
 and s.venue_id = r.venue_id
 and s.enabled = true
where r.active_playlist_id is not null;

alter table public.led_wall_playlists enable row level security;
alter table public.led_wall_playlists force row level security;
alter table public.led_wall_playlist_items enable row level security;
alter table public.led_wall_playlist_items force row level security;

revoke all on public.led_wall_playlists from anon, public, authenticated;
revoke all on public.led_wall_playlist_items from anon, public, authenticated;
revoke all on public.led_wall_active_playlist_listings from anon, public, authenticated;

grant select, insert, update, delete on public.led_wall_playlists to authenticated;
grant select, insert, update, delete on public.led_wall_playlist_items to authenticated;
grant select on public.led_wall_active_playlist_listings to anon, authenticated;

drop policy if exists led_wall_playlists_select_member on public.led_wall_playlists;
create policy led_wall_playlists_select_member
  on public.led_wall_playlists for select to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists led_wall_playlists_insert_admin on public.led_wall_playlists;
create policy led_wall_playlists_insert_admin
  on public.led_wall_playlists for insert to authenticated
  with check (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));

drop policy if exists led_wall_playlists_update_admin on public.led_wall_playlists;
create policy led_wall_playlists_update_admin
  on public.led_wall_playlists for update to authenticated
  using (public.has_venue_role(venue_id, array['admin']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));

drop policy if exists led_wall_playlists_delete_admin on public.led_wall_playlists;
create policy led_wall_playlists_delete_admin
  on public.led_wall_playlists for delete to authenticated
  using (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));

drop policy if exists led_wall_playlist_items_select_member on public.led_wall_playlist_items;
create policy led_wall_playlist_items_select_member
  on public.led_wall_playlist_items for select to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists led_wall_playlist_items_insert_admin on public.led_wall_playlist_items;
create policy led_wall_playlist_items_insert_admin
  on public.led_wall_playlist_items for insert to authenticated
  with check (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));

drop policy if exists led_wall_playlist_items_update_admin on public.led_wall_playlist_items;
create policy led_wall_playlist_items_update_admin
  on public.led_wall_playlist_items for update to authenticated
  using (public.has_venue_role(venue_id, array['admin']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));

drop policy if exists led_wall_playlist_items_delete_admin on public.led_wall_playlist_items;
create policy led_wall_playlist_items_delete_admin
  on public.led_wall_playlist_items for delete to authenticated
  using (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));

notify pgrst, 'reload schema';
