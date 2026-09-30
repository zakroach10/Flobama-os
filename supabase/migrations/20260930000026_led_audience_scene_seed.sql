-- Seed Audience Interactor LED scene (requires audience enum from 00025).

alter table public.led_wall_scenes drop constraint if exists led_wall_scenes_shape;

alter table public.led_wall_scenes
  add constraint led_wall_scenes_shape check (
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
    or (
      kind = 'trivia'
      and obs_scene_name is null
      and media_kind is null
      and storage_path is null
      and public_url is null
    )
    or (
      kind = 'audience'
      and obs_scene_name is null
      and media_kind is null
      and storage_path is null
      and public_url is null
    )
  );

insert into public.led_wall_scenes (
  id,
  venue_id,
  title,
  kind,
  sort_order,
  enabled
)
values (
  '44444444-4444-4444-8444-444444444444',
  '11111111-1111-4111-8111-111111111111',
  'Audience Interactor',
  'audience',
  90,
  true
)
on conflict (id) do nothing;
