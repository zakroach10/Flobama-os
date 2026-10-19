-- PNG menu posters for LED video loops (mobile menus cannot reliably preview MP4).

alter table public.led_wall_scenes
  add column if not exists poster_storage_path text,
  add column if not exists poster_url text;

comment on column public.led_wall_scenes.poster_storage_path is
  'PNG still extracted from media_kind=video for menus; null for image scenes.';
comment on column public.led_wall_scenes.poster_url is
  'Public URL for poster_storage_path.';
