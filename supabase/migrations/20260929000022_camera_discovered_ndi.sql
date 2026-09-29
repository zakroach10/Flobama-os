-- Persist NDI sources discovered on the venue Mac so staff can see them in Cameras.

alter table public.camera_connector_devices
  add column if not exists discovered_ndi jsonb not null default '[]'::jsonb;

comment on column public.camera_connector_devices.discovered_ndi is
  'Latest NDI sources reported by the Mac connector (name, urlAddress, sourceKey).';

notify pgrst, 'reload schema';
