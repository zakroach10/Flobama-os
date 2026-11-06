-- Manual LED preload pins and booth readiness reports.
-- Warming a graphic does not change led_wall_runtime. Apply in the SQL editor; not applied by this change.

create table if not exists public.led_wall_preload_pins (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  scene_id uuid not null references public.led_wall_scenes (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint led_wall_preload_pins_scene_unique unique (venue_id, scene_id)
);

create index if not exists led_wall_preload_pins_venue_idx
  on public.led_wall_preload_pins (venue_id, created_at desc);

comment on table public.led_wall_preload_pins is
  'Staff-pinned visuals for the wall browser to decode ahead of time. Does not make them live.';

create table if not exists public.led_wall_preload_reports (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  scene_id uuid not null references public.led_wall_scenes (id) on delete cascade,
  client_key text not null check (char_length(client_key) between 8 and 80),
  state text not null check (state in ('loading', 'ready', 'error')),
  message text,
  updated_at timestamptz not null default now(),
  constraint led_wall_preload_reports_client_unique unique (venue_id, scene_id, client_key)
);

create index if not exists led_wall_preload_reports_venue_updated_idx
  on public.led_wall_preload_reports (venue_id, updated_at desc);

comment on table public.led_wall_preload_reports is
  'Readiness reported by a wall browser after it fetches and decodes a preloaded visual.';

alter table public.led_wall_preload_pins enable row level security;
alter table public.led_wall_preload_pins force row level security;
alter table public.led_wall_preload_reports enable row level security;
alter table public.led_wall_preload_reports force row level security;

revoke all on public.led_wall_preload_pins from anon, public, authenticated;
revoke all on public.led_wall_preload_reports from anon, public, authenticated;

grant select, insert, delete on public.led_wall_preload_pins to authenticated;
grant select on public.led_wall_preload_reports to authenticated;

drop policy if exists led_wall_preload_pins_select_member on public.led_wall_preload_pins;
create policy led_wall_preload_pins_select_member
  on public.led_wall_preload_pins for select to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists led_wall_preload_pins_insert_member on public.led_wall_preload_pins;
create policy led_wall_preload_pins_insert_member
  on public.led_wall_preload_pins for insert to authenticated
  with check (public.is_venue_member(venue_id));

drop policy if exists led_wall_preload_pins_delete_member on public.led_wall_preload_pins;
create policy led_wall_preload_pins_delete_member
  on public.led_wall_preload_pins for delete to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists led_wall_preload_reports_select_member on public.led_wall_preload_reports;
create policy led_wall_preload_reports_select_member
  on public.led_wall_preload_reports for select to authenticated
  using (public.is_venue_member(venue_id));
