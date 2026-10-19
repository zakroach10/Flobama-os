-- FloBama Performance Library: Ecamm session folders + attached primary/camera assets.

alter table public.performance_library_settings
  add column if not exists dropbox_relative_root text
    default '/A- View 360 Brands/3- Customers/F/Flobama/Recordings';

alter table public.performance_recordings
  add column if not exists session_folder text,
  add column if not exists session_relative_path text,
  add column if not exists primary_asset_id text,
  add column if not exists camera_count integer not null default 0
    check (camera_count >= 0),
  add column if not exists assets jsonb not null default '[]'::jsonb;

comment on column public.performance_library_settings.dropbox_relative_root is
  'Dropbox-relative Recordings path (not the Mac absolute path). Default: /A- View 360 Brands/3- Customers/F/Flobama/Recordings';

comment on column public.performance_recordings.session_folder is
  'Ecamm session folder name, e.g. Ecamm Recording on 2026-10-14 at 17.41.33';

comment on column public.performance_recordings.assets is
  'Attached session videos: [{assetId, role: primary|camera|other, originalFilename, relativePath, fileSize, availability}]';

notify pgrst, 'reload schema';
