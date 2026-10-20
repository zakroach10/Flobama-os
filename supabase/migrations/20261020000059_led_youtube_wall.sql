-- YouTube one-shot takes on the LED wall (Server Station → wall link).
-- Plays via /display/led (or local wall player), then returns to normal programming.

alter type public.screen_media_kind add value if not exists 'youtube';

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
      kind = 'media'
      and obs_scene_name is null
      and media_kind = 'youtube'
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

-- Inline column CHECK is auto-named led_server_items_kind_check.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'led_server_items_kind_check'
      and conrelid = 'public.led_server_items'::regclass
  ) then
    alter table public.led_server_items drop constraint led_server_items_kind_check;
  end if;
end
$$;

alter table public.led_server_items
  add constraint led_server_items_kind_check
  check (kind in (
    'food_special',
    'drink_special',
    'birthday',
    'celebration',
    'message',
    'upload',
    'youtube'
  ));
