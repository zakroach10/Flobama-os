-- Venue-level Audience Interactor settings (podcaster brand logo, etc.).

create table if not exists public.audience_venue_settings (
  venue_id uuid primary key references public.venues (id) on delete cascade,
  brand_logo_path text,
  brand_logo_url text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint audience_venue_settings_logo_pair check (
    (brand_logo_path is null and brand_logo_url is null)
    or (brand_logo_path is not null and brand_logo_url is not null)
  )
);

drop trigger if exists audience_venue_settings_set_updated_at on public.audience_venue_settings;
create trigger audience_venue_settings_set_updated_at
  before update on public.audience_venue_settings
  for each row execute function public.set_updated_at();

alter table public.audience_venue_settings enable row level security;
alter table public.audience_venue_settings force row level security;

revoke all on public.audience_venue_settings from anon, public, authenticated;
grant select, insert, update, delete on public.audience_venue_settings to authenticated;

drop policy if exists audience_venue_settings_select_runner on public.audience_venue_settings;
create policy audience_venue_settings_select_runner
  on public.audience_venue_settings for select to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager', 'interactor']::public.staff_role[]));

drop policy if exists audience_venue_settings_write_runner on public.audience_venue_settings;
create policy audience_venue_settings_write_runner
  on public.audience_venue_settings for all to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager', 'interactor']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin', 'manager', 'interactor']::public.staff_role[]));
