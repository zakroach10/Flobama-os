-- Public event projection, ticket/cover fields, and booth state.
-- Anonymous role still cannot read public.events (including published rows).

alter table public.events
  add column if not exists legacy_source_id text,
  add column if not exists is_ticketed boolean not null default false,
  add column if not exists ticket_url text,
  add column if not exists cover_label text;

alter table public.events
  drop constraint if exists events_ticket_url_len;

alter table public.events
  add constraint events_ticket_url_len
  check (ticket_url is null or char_length(ticket_url) <= 500);

alter table public.events
  drop constraint if exists events_cover_label_len;

alter table public.events
  add constraint events_cover_label_len
  check (cover_label is null or char_length(cover_label) <= 40);

alter table public.events
  drop constraint if exists events_legacy_source_id_len;

alter table public.events
  add constraint events_legacy_source_id_len
  check (legacy_source_id is null or char_length(legacy_source_id) <= 80);

create unique index if not exists events_venue_legacy_source_idx
  on public.events (venue_id, legacy_source_id)
  where legacy_source_id is not null;

create table if not exists public.booth_state (
  venue_id uuid primary key references public.venues (id) on delete cascade,
  live_event_id uuid references public.events (id) on delete set null,
  lower_third_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists booth_state_set_updated_at on public.booth_state;
create trigger booth_state_set_updated_at
  before update on public.booth_state
  for each row execute function public.set_updated_at();

create or replace function public.enforce_booth_live_event_venue()
returns trigger
language plpgsql
as $$
declare
  event_venue uuid;
begin
  if new.live_event_id is null then
    return new;
  end if;
  select venue_id into event_venue from public.events where id = new.live_event_id;
  if event_venue is null or event_venue is distinct from new.venue_id then
    raise exception 'booth live event must belong to the same venue';
  end if;
  return new;
end;
$$;

drop trigger if exists booth_state_same_venue on public.booth_state;
create trigger booth_state_same_venue
  before insert or update on public.booth_state
  for each row execute function public.enforce_booth_live_event_venue();

-- Definer views: only the public-safe columns, never internal_notes.
create or replace view public.event_listings
with (security_invoker = false)
as
select
  e.id,
  e.venue_id,
  e.title,
  e.event_type,
  e.starts_at,
  e.ends_at,
  e.location_label,
  e.featured,
  e.is_ticketed,
  e.ticket_url,
  e.cover_label
from public.events e
where e.status = 'published'
  and e.visibility = 'public'
  and e.archived_at is null;

create or replace view public.event_listing_artists
with (security_invoker = false)
as
select
  ea.event_id,
  ea.venue_id,
  ea.display_order,
  a.name
from public.event_artists ea
join public.artists a on a.id = ea.artist_id
join public.events e on e.id = ea.event_id
where e.status = 'published'
  and e.visibility = 'public'
  and e.archived_at is null;

create or replace function public.get_public_booth_now(p_venue_id uuid)
returns table (
  live_event_id uuid,
  lower_third_visible boolean,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    case when listing.id is not null then b.live_event_id else null end,
    coalesce(b.lower_third_visible, false),
    b.updated_at
  from public.booth_state b
  left join public.event_listings listing on listing.id = b.live_event_id
  where b.venue_id = p_venue_id;
$$;

revoke all on function public.get_public_booth_now(uuid) from public, anon, authenticated;
grant execute on function public.get_public_booth_now(uuid) to anon, authenticated;

alter table public.booth_state enable row level security;
alter table public.booth_state force row level security;

revoke all on public.booth_state from anon, public, authenticated;
grant select, insert, update on public.booth_state to authenticated;

drop policy if exists booth_state_select_member on public.booth_state;
create policy booth_state_select_member
  on public.booth_state
  for select
  to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists booth_state_insert_managers on public.booth_state;
create policy booth_state_insert_managers
  on public.booth_state
  for insert
  to authenticated
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

drop policy if exists booth_state_update_managers on public.booth_state;
create policy booth_state_update_managers
  on public.booth_state
  for update
  to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

revoke all on public.event_listings from anon, public, authenticated;
revoke all on public.event_listing_artists from anon, public, authenticated;
grant select on public.event_listings to anon, authenticated;
grant select on public.event_listing_artists to anon, authenticated;

notify pgrst, 'reload schema';
