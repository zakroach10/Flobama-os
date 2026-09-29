-- Store preview frames inline so remote preview works even when storage upload fails.

alter table public.camera_preview_sessions
  add column if not exists snapshot_base64 text;

comment on column public.camera_preview_sessions.snapshot_base64 is
  'Bandwidth-limited JPEG/PNG preview frame (base64). Preferred over storage for Mac connector snapshots.';

notify pgrst, 'reload schema';
