-- Timed vertical takeover so a band or event graphic can hold every TV.
-- Anonymous role cannot read screen_takeovers; public data is the view only.

create table if not exists public.screen_takeovers (
  venue_id uuid primary key references public.venues (id) on delete cascade,
  ad_id uuid not null references public.screen_ads (id) on delete cascade,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint screen_takeovers_ends_at_future check (ends_at is null or ends_at > created_at)
);

drop trigger if exists screen_takeovers_set_updated_at on public.screen_takeovers;
create trigger screen_takeovers_set_updated_at
  before update on public.screen_takeovers
  for each row execute function public.set_updated_at();

create or replace view public.screen_takeover_listings
with (security_invoker = false)
as
select
  t.venue_id,
  t.ad_id,
  t.ends_at,
  t.updated_at,
  a.title,
  a.public_url,
  a.media_kind,
  a.duration_seconds,
  a.transition
from public.screen_takeovers t
join public.screen_ads a on a.id = t.ad_id
where a.archived_at is null
  and (t.ends_at is null or t.ends_at > now());

alter table public.screen_takeovers enable row level security;
alter table public.screen_takeovers force row level security;

revoke all on public.screen_takeovers from anon, public, authenticated;
revoke all on public.screen_takeover_listings from anon, public, authenticated;

grant select, insert, update, delete on public.screen_takeovers to authenticated;
grant select on public.screen_takeover_listings to anon, authenticated;

drop policy if exists screen_takeovers_select_member on public.screen_takeovers;
create policy screen_takeovers_select_member
  on public.screen_takeovers
  for select
  to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists screen_takeovers_insert_managers on public.screen_takeovers;
create policy screen_takeovers_insert_managers
  on public.screen_takeovers
  for insert
  to authenticated
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

drop policy if exists screen_takeovers_update_managers on public.screen_takeovers;
create policy screen_takeovers_update_managers
  on public.screen_takeovers
  for update
  to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

drop policy if exists screen_takeovers_delete_managers on public.screen_takeovers;
create policy screen_takeovers_delete_managers
  on public.screen_takeovers
  for delete
  to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

notify pgrst, 'reload schema';
