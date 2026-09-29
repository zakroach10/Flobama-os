-- Named screen playlists + food/drink specials for vertical rotation.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'menu_special_category') then
    create type public.menu_special_category as enum ('food', 'drink');
  end if;
  if not exists (select 1 from pg_type where typname = 'screen_playlist_item_source') then
    create type public.screen_playlist_item_source as enum ('media', 'special', 'week_events');
  end if;
end
$$;

create table if not exists public.menu_specials (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  subtitle text check (subtitle is null or char_length(btrim(subtitle)) between 1 and 240),
  category public.menu_special_category not null,
  price_label text check (price_label is null or char_length(btrim(price_label)) between 1 and 40),
  storage_path text not null check (char_length(storage_path) between 1 and 500),
  public_url text not null check (char_length(public_url) between 1 and 800),
  media_kind public.screen_media_kind not null default 'image'
    check (media_kind in ('image', 'video')),
  duration_seconds integer not null default 12 check (duration_seconds between 1 and 600),
  starts_at timestamptz,
  ends_at timestamptz,
  enabled boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index if not exists menu_specials_venue_idx
  on public.menu_specials (venue_id, category)
  where archived_at is null;

drop trigger if exists menu_specials_set_updated_at on public.menu_specials;
create trigger menu_specials_set_updated_at
  before update on public.menu_specials
  for each row execute function public.set_updated_at();

create table if not exists public.screen_playlists (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  is_active boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists screen_playlists_one_active_per_venue_idx
  on public.screen_playlists (venue_id)
  where is_active = true and archived_at is null;

create index if not exists screen_playlists_venue_idx
  on public.screen_playlists (venue_id)
  where archived_at is null;

drop trigger if exists screen_playlists_set_updated_at on public.screen_playlists;
create trigger screen_playlists_set_updated_at
  before update on public.screen_playlists
  for each row execute function public.set_updated_at();

create table if not exists public.screen_playlist_items (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.screen_playlists (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  source_kind public.screen_playlist_item_source not null,
  media_id uuid references public.screen_ads (id) on delete cascade,
  special_id uuid references public.menu_specials (id) on delete cascade,
  duration_seconds integer check (duration_seconds is null or duration_seconds between 1 and 600),
  transition public.screen_transition not null default 'fade',
  sort_order integer not null default 0 check (sort_order >= 0),
  enabled boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (
      source_kind = 'media'
      and media_id is not null
      and special_id is null
    )
    or (
      source_kind = 'special'
      and special_id is not null
      and media_id is null
    )
    or (
      source_kind = 'week_events'
      and media_id is null
      and special_id is null
    )
  )
);

create index if not exists screen_playlist_items_playlist_order_idx
  on public.screen_playlist_items (playlist_id, sort_order)
  where archived_at is null;

drop trigger if exists screen_playlist_items_set_updated_at on public.screen_playlist_items;
create trigger screen_playlist_items_set_updated_at
  before update on public.screen_playlist_items
  for each row execute function public.set_updated_at();

-- Seed a default active playlist per venue and migrate current ads into it.
insert into public.screen_playlists (venue_id, name, is_active)
select v.id, 'Main rotation', true
from public.venues v
where not exists (
  select 1 from public.screen_playlists p
  where p.venue_id = v.id and p.archived_at is null
);

insert into public.screen_playlist_items (
  playlist_id,
  venue_id,
  source_kind,
  media_id,
  duration_seconds,
  transition,
  sort_order,
  enabled
)
select
  p.id,
  a.venue_id,
  case
    when a.media_kind = 'week_events' or a.public_url like 'dynamic://week_events%' then 'week_events'::public.screen_playlist_item_source
    else 'media'::public.screen_playlist_item_source
  end,
  case
    when a.media_kind = 'week_events' or a.public_url like 'dynamic://week_events%' then null
    else a.id
  end,
  a.duration_seconds,
  a.transition,
  a.sort_order,
  a.enabled
from public.screen_ads a
join public.screen_playlists p
  on p.venue_id = a.venue_id
 and p.is_active = true
 and p.archived_at is null
where a.archived_at is null
  and not exists (
    select 1
    from public.screen_playlist_items i
    where i.playlist_id = p.id
      and i.archived_at is null
      and (
        (i.media_id is not null and i.media_id = a.id)
        or (
          i.source_kind = 'week_events'
          and (a.media_kind = 'week_events' or a.public_url like 'dynamic://week_events%')
        )
      )
  );

create or replace view public.screen_active_playlist_listings
with (security_invoker = false)
as
select
  i.id,
  i.venue_id,
  coalesce(a.title, s.title, 'This week''s events') as title,
  coalesce(a.public_url, s.public_url, 'dynamic://week_events') as public_url,
  case
    when i.source_kind = 'week_events' then 'week_events'::public.screen_media_kind
    when i.source_kind = 'special' then coalesce(s.media_kind, 'image'::public.screen_media_kind)
    else a.media_kind
  end as media_kind,
  coalesce(
    i.duration_seconds,
    a.duration_seconds,
    s.duration_seconds,
    12
  ) as duration_seconds,
  i.transition,
  i.sort_order
from public.screen_playlist_items i
join public.screen_playlists p
  on p.id = i.playlist_id
 and p.is_active = true
 and p.archived_at is null
left join public.screen_ads a
  on a.id = i.media_id
 and a.archived_at is null
left join public.menu_specials s
  on s.id = i.special_id
 and s.archived_at is null
 and s.enabled = true
 and (s.starts_at is null or s.starts_at <= now())
 and (s.ends_at is null or s.ends_at > now())
where i.enabled = true
  and i.archived_at is null
  and (
    (i.source_kind = 'media' and a.id is not null and a.enabled = true)
    or (i.source_kind = 'special' and s.id is not null)
    or i.source_kind = 'week_events'
  );

alter table public.menu_specials enable row level security;
alter table public.menu_specials force row level security;
alter table public.screen_playlists enable row level security;
alter table public.screen_playlists force row level security;
alter table public.screen_playlist_items enable row level security;
alter table public.screen_playlist_items force row level security;

revoke all on public.menu_specials from anon, public, authenticated;
revoke all on public.screen_playlists from anon, public, authenticated;
revoke all on public.screen_playlist_items from anon, public, authenticated;
revoke all on public.screen_active_playlist_listings from anon, public, authenticated;

grant select, insert, update on public.menu_specials to authenticated;
grant select, insert, update on public.screen_playlists to authenticated;
grant select, insert, update on public.screen_playlist_items to authenticated;
grant select on public.screen_active_playlist_listings to anon, authenticated;

drop policy if exists menu_specials_select_member on public.menu_specials;
create policy menu_specials_select_member
  on public.menu_specials for select to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists menu_specials_insert_managers on public.menu_specials;
create policy menu_specials_insert_managers
  on public.menu_specials for insert to authenticated
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

drop policy if exists menu_specials_update_managers on public.menu_specials;
create policy menu_specials_update_managers
  on public.menu_specials for update to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

drop policy if exists screen_playlists_select_member on public.screen_playlists;
create policy screen_playlists_select_member
  on public.screen_playlists for select to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists screen_playlists_insert_managers on public.screen_playlists;
create policy screen_playlists_insert_managers
  on public.screen_playlists for insert to authenticated
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

drop policy if exists screen_playlists_update_managers on public.screen_playlists;
create policy screen_playlists_update_managers
  on public.screen_playlists for update to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

drop policy if exists screen_playlist_items_select_member on public.screen_playlist_items;
create policy screen_playlist_items_select_member
  on public.screen_playlist_items for select to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists screen_playlist_items_insert_managers on public.screen_playlist_items;
create policy screen_playlist_items_insert_managers
  on public.screen_playlist_items for insert to authenticated
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

drop policy if exists screen_playlist_items_update_managers on public.screen_playlist_items;
create policy screen_playlist_items_update_managers
  on public.screen_playlist_items for update to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));
