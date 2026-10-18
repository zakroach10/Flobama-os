-- Kiosk logins that are a name and PIN only. They are not auth.users and
-- cannot open the staff app. Server Station writes created_by as null for them.

create table if not exists public.server_station_operators (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  display_name text not null,
  pin_hash text not null,
  pin_salt text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint server_station_operators_name_len check (char_length(btrim(display_name)) between 1 and 40),
  constraint server_station_operators_failed_attempts_nonneg check (failed_attempts >= 0)
);

create unique index if not exists server_station_operators_active_name_uidx
  on public.server_station_operators (venue_id, lower(btrim(display_name)))
  where archived_at is null;

create index if not exists server_station_operators_venue_idx
  on public.server_station_operators (venue_id)
  where archived_at is null;

drop trigger if exists server_station_operators_set_updated_at on public.server_station_operators;
create trigger server_station_operators_set_updated_at
  before update on public.server_station_operators
  for each row execute function public.set_updated_at();

alter table public.server_station_operators enable row level security;
alter table public.server_station_operators force row level security;
revoke all on public.server_station_operators from anon, public, authenticated;
grant select, insert, update on public.server_station_operators to authenticated;

drop policy if exists server_station_operators_admin on public.server_station_operators;
create policy server_station_operators_admin
  on public.server_station_operators
  for all
  to authenticated
  using (public.has_venue_role(venue_id, array['admin']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));
