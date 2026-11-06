-- Allow multiple LED visualizers per artist; pick default for auto-roll / showtime.

drop index if exists public.led_wall_scenes_artist_uidx;

alter table public.led_wall_scenes
  add column if not exists is_default boolean not null default false;

-- Existing artist-owned scenes become the default for that artist.
update public.led_wall_scenes
set is_default = true
where artist_id is not null
  and is_default = false
  and id in (
    select distinct on (artist_id) id
    from public.led_wall_scenes
    where artist_id is not null
    order by artist_id, updated_at desc nulls last, created_at desc nulls last, id
  );

create unique index if not exists led_wall_scenes_artist_default_uidx
  on public.led_wall_scenes (artist_id)
  where artist_id is not null and is_default = true;

comment on column public.led_wall_scenes.is_default is
  'When true, this artist visualizer is used for auto-roll unless staff picks another at showtime';
