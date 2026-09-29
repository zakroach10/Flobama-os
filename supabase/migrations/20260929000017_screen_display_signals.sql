-- Manual reload signal for OBS / kiosk browser sources (LED + vertical).

create table if not exists public.screen_display_signals (
  venue_id uuid primary key references public.venues (id) on delete cascade,
  reload_nonce bigint not null default 1 check (reload_nonce >= 1),
  reload_requested_at timestamptz not null default now(),
  reload_requested_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists screen_display_signals_set_updated_at on public.screen_display_signals;
create trigger screen_display_signals_set_updated_at
  before update on public.screen_display_signals
  for each row execute function public.set_updated_at();

insert into public.screen_display_signals (venue_id, reload_nonce)
select v.id, 1
from public.venues v
on conflict (venue_id) do nothing;

create or replace view public.screen_display_signal_listings
with (security_invoker = false)
as
select
  venue_id,
  reload_nonce,
  reload_requested_at
from public.screen_display_signals;

alter table public.screen_display_signals enable row level security;
alter table public.screen_display_signals force row level security;

revoke all on public.screen_display_signals from anon, public, authenticated;
revoke all on public.screen_display_signal_listings from anon, public, authenticated;

grant select, insert, update on public.screen_display_signals to authenticated;
grant select on public.screen_display_signal_listings to anon, authenticated;

drop policy if exists screen_display_signals_select_member on public.screen_display_signals;
create policy screen_display_signals_select_member
  on public.screen_display_signals for select to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists screen_display_signals_insert_member on public.screen_display_signals;
create policy screen_display_signals_insert_member
  on public.screen_display_signals for insert to authenticated
  with check (public.is_venue_member(venue_id));

drop policy if exists screen_display_signals_update_member on public.screen_display_signals;
create policy screen_display_signals_update_member
  on public.screen_display_signals for update to authenticated
  using (public.is_venue_member(venue_id))
  with check (public.is_venue_member(venue_id));

notify pgrst, 'reload schema';
