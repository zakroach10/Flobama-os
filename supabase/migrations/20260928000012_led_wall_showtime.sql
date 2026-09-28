-- One ad-roll video can loop until the next show starts, then the wall
-- cuts to the first billed artist's configuration.

alter table public.led_wall_scenes
  add column if not exists rolls_until_showtime boolean not null default false;

alter table public.led_wall_scenes
  drop constraint if exists led_wall_scenes_ad_roll;

alter table public.led_wall_scenes
  add constraint led_wall_scenes_ad_roll check (
    rolls_until_showtime = false
    or (kind = 'media' and media_kind = 'video')
  );

create unique index if not exists led_wall_scenes_one_ad_roll_idx
  on public.led_wall_scenes (venue_id)
  where rolls_until_showtime;

alter table public.artists
  add column if not exists led_wall_scene_id uuid references public.led_wall_scenes (id) on delete set null;

create index if not exists artists_led_wall_scene_idx
  on public.artists (led_wall_scene_id)
  where led_wall_scene_id is not null;

create or replace function public.artists_led_wall_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.led_wall_scene_id is not distinct from old.led_wall_scene_id then
    return new;
  end if;

  if auth.uid() is not null
    and not public.has_venue_role(new.venue_id, array['admin']::public.staff_role[]) then
    raise exception 'Only admins can assign an LED wall configuration.';
  end if;

  if new.led_wall_scene_id is not null
    and not exists (
      select 1
      from public.led_wall_scenes s
      where s.id = new.led_wall_scene_id
        and s.venue_id = new.venue_id
        and s.enabled = true
    ) then
    raise exception 'That configuration is not available.';
  end if;

  return new;
end;
$$;

drop trigger if exists artists_led_wall_guard on public.artists;
create trigger artists_led_wall_guard
  before update on public.artists
  for each row execute function public.artists_led_wall_guard();

revoke all on function public.artists_led_wall_guard() from public, anon, authenticated;

notify pgrst, 'reload schema';
