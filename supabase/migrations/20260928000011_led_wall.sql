-- LED wall scene catalog, booth-client status, and the public media page.
-- Anonymous role cannot read scenes, settings, runtime, or agent secrets.
-- The agent token hash lives in led_wall_agent_secrets with no staff policies.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'led_wall_scene_kind') then
    create type public.led_wall_scene_kind as enum ('obs', 'media');
  end if;
end
$$;

create table if not exists public.led_wall_scenes (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  kind public.led_wall_scene_kind not null,
  obs_scene_name text check (obs_scene_name is null or char_length(obs_scene_name) between 1 and 200),
  media_kind public.screen_media_kind,
  storage_path text check (storage_path is null or char_length(storage_path) between 1 and 500),
  public_url text check (public_url is null or char_length(public_url) between 1 and 800),
  sort_order integer not null default 0 check (sort_order >= 0),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint led_wall_scenes_shape check (
    (
      kind = 'obs'
      and obs_scene_name is not null
      and media_kind is null
      and storage_path is null
      and public_url is null
    )
    or (
      kind = 'media'
      and obs_scene_name is null
      and media_kind in ('image', 'video')
      and storage_path is not null
      and public_url is not null
    )
  )
);

create index if not exists led_wall_scenes_venue_order_idx
  on public.led_wall_scenes (venue_id, sort_order);

drop trigger if exists led_wall_scenes_set_updated_at on public.led_wall_scenes;
create trigger led_wall_scenes_set_updated_at
  before update on public.led_wall_scenes
  for each row execute function public.set_updated_at();

create table if not exists public.led_wall_settings (
  venue_id uuid primary key references public.venues (id) on delete cascade,
  media_obs_scene_name text check (
    media_obs_scene_name is null or char_length(media_obs_scene_name) between 1 and 200
  ),
  agent_token_issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists led_wall_settings_set_updated_at on public.led_wall_settings;
create trigger led_wall_settings_set_updated_at
  before update on public.led_wall_settings
  for each row execute function public.set_updated_at();

create table if not exists public.led_wall_agent_secrets (
  venue_id uuid primary key references public.venues (id) on delete cascade,
  token_hash text not null check (char_length(token_hash) = 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists led_wall_agent_secrets_set_updated_at on public.led_wall_agent_secrets;
create trigger led_wall_agent_secrets_set_updated_at
  before update on public.led_wall_agent_secrets
  for each row execute function public.set_updated_at();

create table if not exists public.led_wall_runtime (
  venue_id uuid primary key references public.venues (id) on delete cascade,
  active_scene_id uuid references public.led_wall_scenes (id) on delete set null,
  activated_by uuid references auth.users (id) on delete set null,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists led_wall_runtime_set_updated_at on public.led_wall_runtime;
create trigger led_wall_runtime_set_updated_at
  before update on public.led_wall_runtime
  for each row execute function public.set_updated_at();

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

  if tg_op = 'INSERT' then
    new.activated_by := auth.uid();
    new.activated_at := now();
  elsif new.active_scene_id is distinct from old.active_scene_id then
    new.activated_by := auth.uid();
    new.activated_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists led_wall_runtime_guard on public.led_wall_runtime;
create trigger led_wall_runtime_guard
  before insert or update on public.led_wall_runtime
  for each row execute function public.led_wall_runtime_guard();

create table if not exists public.led_wall_agent_status (
  venue_id uuid primary key references public.venues (id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  obs_connected boolean not null default false,
  program_scene text check (program_scene is null or char_length(program_scene) between 1 and 200),
  obs_scenes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists led_wall_agent_status_set_updated_at on public.led_wall_agent_status;
create trigger led_wall_agent_status_set_updated_at
  before update on public.led_wall_agent_status
  for each row execute function public.set_updated_at();

create or replace view public.led_wall_active_media
with (security_invoker = false)
as
select
  r.venue_id,
  s.id as scene_id,
  s.title,
  s.media_kind,
  s.public_url,
  r.activated_at
from public.led_wall_runtime r
join public.led_wall_scenes s on s.id = r.active_scene_id
where s.kind = 'media'
  and s.enabled = true
  and s.public_url is not null;

alter table public.led_wall_scenes enable row level security;
alter table public.led_wall_scenes force row level security;
alter table public.led_wall_settings enable row level security;
alter table public.led_wall_settings force row level security;
alter table public.led_wall_agent_secrets enable row level security;
alter table public.led_wall_agent_secrets force row level security;
alter table public.led_wall_runtime enable row level security;
alter table public.led_wall_runtime force row level security;
alter table public.led_wall_agent_status enable row level security;
alter table public.led_wall_agent_status force row level security;

revoke all on public.led_wall_scenes from anon, public, authenticated;
revoke all on public.led_wall_settings from anon, public, authenticated;
revoke all on public.led_wall_agent_secrets from anon, public, authenticated;
revoke all on public.led_wall_runtime from anon, public, authenticated;
revoke all on public.led_wall_agent_status from anon, public, authenticated;
revoke all on public.led_wall_active_media from anon, public, authenticated;
revoke all on function public.led_wall_runtime_guard() from public, anon, authenticated;

grant select, insert, update, delete on public.led_wall_scenes to authenticated;
grant select, insert, update on public.led_wall_settings to authenticated;
grant select, insert, update on public.led_wall_runtime to authenticated;
grant select on public.led_wall_agent_status to authenticated;
grant select on public.led_wall_active_media to anon, authenticated;

drop policy if exists led_wall_scenes_select_member on public.led_wall_scenes;
create policy led_wall_scenes_select_member
  on public.led_wall_scenes
  for select
  to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists led_wall_scenes_insert_admin on public.led_wall_scenes;
create policy led_wall_scenes_insert_admin
  on public.led_wall_scenes
  for insert
  to authenticated
  with check (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));

drop policy if exists led_wall_scenes_update_admin on public.led_wall_scenes;
create policy led_wall_scenes_update_admin
  on public.led_wall_scenes
  for update
  to authenticated
  using (public.has_venue_role(venue_id, array['admin']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));

drop policy if exists led_wall_scenes_delete_admin on public.led_wall_scenes;
create policy led_wall_scenes_delete_admin
  on public.led_wall_scenes
  for delete
  to authenticated
  using (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));

drop policy if exists led_wall_settings_select_admin on public.led_wall_settings;
create policy led_wall_settings_select_admin
  on public.led_wall_settings
  for select
  to authenticated
  using (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));

drop policy if exists led_wall_settings_insert_admin on public.led_wall_settings;
create policy led_wall_settings_insert_admin
  on public.led_wall_settings
  for insert
  to authenticated
  with check (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));

drop policy if exists led_wall_settings_update_admin on public.led_wall_settings;
create policy led_wall_settings_update_admin
  on public.led_wall_settings
  for update
  to authenticated
  using (public.has_venue_role(venue_id, array['admin']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));

drop policy if exists led_wall_runtime_select_member on public.led_wall_runtime;
create policy led_wall_runtime_select_member
  on public.led_wall_runtime
  for select
  to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists led_wall_runtime_insert_member on public.led_wall_runtime;
create policy led_wall_runtime_insert_member
  on public.led_wall_runtime
  for insert
  to authenticated
  with check (public.is_venue_member(venue_id));

drop policy if exists led_wall_runtime_update_member on public.led_wall_runtime;
create policy led_wall_runtime_update_member
  on public.led_wall_runtime
  for update
  to authenticated
  using (public.is_venue_member(venue_id))
  with check (public.is_venue_member(venue_id));

drop policy if exists led_wall_agent_status_select_member on public.led_wall_agent_status;
create policy led_wall_agent_status_select_member
  on public.led_wall_agent_status
  for select
  to authenticated
  using (public.is_venue_member(venue_id));

notify pgrst, 'reload schema';
