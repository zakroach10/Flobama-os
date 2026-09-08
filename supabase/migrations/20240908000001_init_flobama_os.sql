-- FloBama OS core schema, RLS, and FloBama venue seed.
-- Anonymous roles have no access to internal tables.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'staff_role') then
    create type public.staff_role as enum ('admin', 'manager', 'viewer');
  end if;
  if not exists (select 1 from pg_type where typname = 'event_status') then
    create type public.event_status as enum ('draft', 'published', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'event_visibility') then
    create type public.event_visibility as enum ('public', 'private');
  end if;
  if not exists (select 1 from pg_type where typname = 'event_type') then
    create type public.event_type as enum (
      'live_music',
      'karaoke',
      'dj',
      'sports',
      'private_event',
      'other'
    );
  end if;
end
$$;

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  timezone text not null default 'America/Chicago' check (timezone = 'America/Chicago'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.venue_memberships (
  venue_id uuid not null references public.venues (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.staff_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (venue_id, user_id)
);

create unique index if not exists venue_memberships_user_venue_idx
  on public.venue_memberships (user_id, venue_id);

create table if not exists public.artists (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  genre text check (genre is null or char_length(genre) <= 80),
  bio text check (bio is null or char_length(bio) <= 4000),
  website_url text check (website_url is null or char_length(website_url) <= 500),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists artists_venue_name_idx on public.artists (venue_id, lower(name));
create index if not exists artists_venue_active_idx on public.artists (venue_id) where archived_at is null;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  public_description text check (public_description is null or char_length(public_description) <= 8000),
  internal_notes text check (internal_notes is null or char_length(internal_notes) <= 8000),
  event_type public.event_type not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location_label text check (location_label is null or char_length(location_label) <= 160),
  status public.event_status not null default 'draft',
  visibility public.event_visibility not null default 'public',
  featured boolean not null default false,
  archived_at timestamptz,
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_valid_range check (ends_at > starts_at)
);

create index if not exists events_venue_starts_idx on public.events (venue_id, starts_at);
create index if not exists events_venue_status_idx on public.events (venue_id, status);
create index if not exists events_venue_active_starts_idx
  on public.events (venue_id, starts_at)
  where archived_at is null;

create table if not exists public.event_artists (
  venue_id uuid not null references public.venues (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  artist_id uuid not null references public.artists (id) on delete restrict,
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, artist_id)
);

create index if not exists event_artists_artist_idx on public.event_artists (artist_id, event_id);
create index if not exists event_artists_venue_idx on public.event_artists (venue_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists venues_set_updated_at on public.venues;
create trigger venues_set_updated_at
  before update on public.venues
  for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists venue_memberships_set_updated_at on public.venue_memberships;
create trigger venue_memberships_set_updated_at
  before update on public.venue_memberships
  for each row execute function public.set_updated_at();

drop trigger if exists artists_set_updated_at on public.artists;
create trigger artists_set_updated_at
  before update on public.artists
  for each row execute function public.set_updated_at();

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

drop trigger if exists event_artists_set_updated_at on public.event_artists;
create trigger event_artists_set_updated_at
  before update on public.event_artists
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), 'Staff')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.stamp_event_actors()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    new.updated_by = auth.uid();
    if tg_op = 'INSERT' then
      new.created_by = coalesce(new.created_by, auth.uid());
    else
      new.created_by = old.created_by;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists events_stamp_actors on public.events;
create trigger events_stamp_actors
  before insert or update on public.events
  for each row execute function public.stamp_event_actors();

create or replace function public.enforce_event_artist_same_venue()
returns trigger
language plpgsql
as $$
declare
  event_venue uuid;
  artist_venue uuid;
begin
  select venue_id into event_venue from public.events where id = new.event_id;
  select venue_id into artist_venue from public.artists where id = new.artist_id;

  if event_venue is null then
    raise exception 'event does not exist';
  end if;
  if artist_venue is null then
    raise exception 'artist does not exist';
  end if;
  if new.venue_id is distinct from event_venue or new.venue_id is distinct from artist_venue then
    raise exception 'event and artist must belong to the same venue as event_artists.venue_id';
  end if;
  return new;
end;
$$;

drop trigger if exists event_artists_same_venue on public.event_artists;
create trigger event_artists_same_venue
  before insert or update on public.event_artists
  for each row execute function public.enforce_event_artist_same_venue();

create or replace function public.prevent_event_venue_change()
returns trigger
language plpgsql
as $$
begin
  if new.venue_id is distinct from old.venue_id then
    raise exception 'event venue_id cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists events_prevent_venue_change on public.events;
create trigger events_prevent_venue_change
  before update on public.events
  for each row execute function public.prevent_event_venue_change();

create or replace function public.prevent_artist_venue_change()
returns trigger
language plpgsql
as $$
begin
  if new.venue_id is distinct from old.venue_id then
    raise exception 'artist venue_id cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists artists_prevent_venue_change on public.artists;
create trigger artists_prevent_venue_change
  before update on public.artists
  for each row execute function public.prevent_artist_venue_change();

-- ---------------------------------------------------------------------------
-- Authorization helpers (security definer, locked search_path)
-- ---------------------------------------------------------------------------

create or replace function public.current_membership_role(p_venue_id uuid)
returns public.staff_role
language sql
stable
security definer
set search_path = public
as $$
  select m.role
  from public.venue_memberships m
  where m.venue_id = p_venue_id
    and m.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_venue_member(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.venue_memberships m
    where m.venue_id = p_venue_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_venue_role(p_venue_id uuid, p_roles public.staff_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.venue_memberships m
    where m.venue_id = p_venue_id
      and m.user_id = auth.uid()
      and m.role = any (p_roles)
  );
$$;

revoke all on function public.current_membership_role(uuid) from public, anon;
revoke all on function public.is_venue_member(uuid) from public, anon;
revoke all on function public.has_venue_role(uuid, public.staff_role[]) from public, anon;
grant execute on function public.current_membership_role(uuid) to authenticated;
grant execute on function public.is_venue_member(uuid) to authenticated;
grant execute on function public.has_venue_role(uuid, public.staff_role[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Grants: least privilege. Anon has none.
-- ---------------------------------------------------------------------------

revoke all on schema public from anon;
grant usage on schema public to authenticated;

revoke all on public.venues from anon, public, authenticated;
revoke all on public.profiles from anon, public, authenticated;
revoke all on public.venue_memberships from anon, public, authenticated;
revoke all on public.artists from anon, public, authenticated;
revoke all on public.events from anon, public, authenticated;
revoke all on public.event_artists from anon, public, authenticated;

grant select on public.venues to authenticated;
grant update (name) on public.venues to authenticated;

grant select, insert on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

grant select on public.venue_memberships to authenticated;
-- no insert/update/delete for authenticated: memberships are administrative SQL only

grant select, insert, update on public.artists to authenticated;
grant select, insert, update on public.events to authenticated;
grant select, insert, update, delete on public.event_artists to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.venues enable row level security;
alter table public.profiles enable row level security;
alter table public.venue_memberships enable row level security;
alter table public.artists enable row level security;
alter table public.events enable row level security;
alter table public.event_artists enable row level security;

alter table public.venues force row level security;
alter table public.profiles force row level security;
alter table public.venue_memberships force row level security;
alter table public.artists force row level security;
alter table public.events force row level security;
alter table public.event_artists force row level security;

drop policy if exists venues_select_member on public.venues;
create policy venues_select_member
  on public.venues
  for select
  to authenticated
  using (public.is_venue_member(id));

drop policy if exists venues_update_admin on public.venues;
create policy venues_update_admin
  on public.venues
  for update
  to authenticated
  using (public.has_venue_role(id, array['admin']::public.staff_role[]))
  with check (public.has_venue_role(id, array['admin']::public.staff_role[]));

drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists venue_memberships_select_self on public.venue_memberships;
create policy venue_memberships_select_self
  on public.venue_memberships
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists artists_select_member on public.artists;
create policy artists_select_member
  on public.artists
  for select
  to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists artists_write_managers on public.artists;
create policy artists_write_managers
  on public.artists
  for insert
  to authenticated
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

drop policy if exists artists_update_managers on public.artists;
create policy artists_update_managers
  on public.artists
  for update
  to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

drop policy if exists events_select_member on public.events;
create policy events_select_member
  on public.events
  for select
  to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists events_insert_managers on public.events;
create policy events_insert_managers
  on public.events
  for insert
  to authenticated
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

drop policy if exists events_update_managers on public.events;
create policy events_update_managers
  on public.events
  for update
  to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

drop policy if exists event_artists_select_member on public.event_artists;
create policy event_artists_select_member
  on public.event_artists
  for select
  to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists event_artists_insert_managers on public.event_artists;
create policy event_artists_insert_managers
  on public.event_artists
  for insert
  to authenticated
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

drop policy if exists event_artists_update_managers on public.event_artists;
create policy event_artists_update_managers
  on public.event_artists
  for update
  to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

drop policy if exists event_artists_delete_managers on public.event_artists;
create policy event_artists_delete_managers
  on public.event_artists
  for delete
  to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

-- ---------------------------------------------------------------------------
-- Seed: FloBama Music Hall only. No fictional shows or artists.
-- ---------------------------------------------------------------------------

insert into public.venues (id, name, timezone)
values (
  '11111111-1111-4111-8111-111111111111',
  'FloBama Music Hall',
  'America/Chicago'
)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
