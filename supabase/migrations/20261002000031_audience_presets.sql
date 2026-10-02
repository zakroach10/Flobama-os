-- Venue-level reusable Audience Interactor presets (per tool kind / game mode).

create table if not exists public.audience_presets (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  kind public.audience_tool_kind not null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists audience_presets_venue_kind_idx
  on public.audience_presets (venue_id, kind, updated_at desc);

drop trigger if exists audience_presets_set_updated_at on public.audience_presets;
create trigger audience_presets_set_updated_at
  before update on public.audience_presets
  for each row execute function public.set_updated_at();

alter table public.audience_presets enable row level security;
alter table public.audience_presets force row level security;

revoke all on public.audience_presets from anon, public, authenticated;
grant select, insert, update, delete on public.audience_presets to authenticated;

drop policy if exists audience_presets_select_runner on public.audience_presets;
create policy audience_presets_select_runner
  on public.audience_presets for select to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager', 'interactor']::public.staff_role[]));

drop policy if exists audience_presets_write_runner on public.audience_presets;
create policy audience_presets_write_runner
  on public.audience_presets for all to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager', 'interactor']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin', 'manager', 'interactor']::public.staff_role[]));
