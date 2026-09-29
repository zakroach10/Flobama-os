-- Seed Shoals Trivia LED scene (requires trivia enum from 00013 already committed).

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
  '33333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111',
  'Shoals Trivia',
  'trivia',
  0,
  true
)
on conflict (id) do nothing;
