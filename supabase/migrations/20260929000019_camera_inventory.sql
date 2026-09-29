-- Staff-managed camera inventory (desired cameras). Mac reports live status into camera_sources.

create table if not exists public.camera_inventory (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  source_key text not null check (char_length(btrim(source_key)) between 1 and 200),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  protocol public.camera_protocol not null default 'ndi_ptz',
  connection_target text check (connection_target is null or char_length(btrim(connection_target)) between 1 and 200),
  connection_port integer check (connection_port is null or (connection_port >= 1 and connection_port <= 65535)),
  is_program_output boolean not null default false,
  supports_ptz boolean not null default true,
  supports_zoom boolean not null default true,
  supports_presets boolean not null default true,
  supports_preset_save boolean not null default false,
  supports_focus boolean not null default false,
  enabled boolean not null default true,
  notes text check (notes is null or char_length(notes) <= 500),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, source_key)
);

create index if not exists camera_inventory_venue_idx
  on public.camera_inventory (venue_id, sort_order);

drop trigger if exists camera_inventory_set_updated_at on public.camera_inventory;
create trigger camera_inventory_set_updated_at
  before update on public.camera_inventory
  for each row execute function public.set_updated_at();

alter table public.camera_sources
  add column if not exists inventory_id uuid references public.camera_inventory (id) on delete set null,
  add column if not exists connection_target text,
  add column if not exists connection_port integer,
  add column if not exists link_status text not null default 'unknown'
    check (link_status in ('unknown', 'simulated', 'ndi_pending', 'ndi_live', 'visca_pending', 'visca_live', 'offline', 'error'));

alter table public.camera_sources
  alter column device_id drop not null;

alter table public.camera_connector_devices
  add column if not exists status_detail text;

alter table public.camera_connector_devices
  add column if not exists menubar_enabled boolean not null default true;

alter table public.camera_sources enable row level security;
alter table public.camera_sources force row level security;
alter table public.camera_inventory enable row level security;
alter table public.camera_inventory force row level security;

revoke all on public.camera_inventory from anon, public, authenticated;
grant select on public.camera_inventory to authenticated;
grant insert, update, delete on public.camera_inventory to authenticated;

drop policy if exists camera_inventory_select_member on public.camera_inventory;
create policy camera_inventory_select_member
  on public.camera_inventory for select to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists camera_inventory_write_admin on public.camera_inventory;
create policy camera_inventory_write_admin
  on public.camera_inventory for all to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

-- Managers/admins can insert staff-managed source rows (device may claim later).
drop policy if exists camera_sources_insert_staff on public.camera_sources;
create policy camera_sources_insert_staff
  on public.camera_sources for insert to authenticated
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

drop policy if exists camera_sources_update_staff on public.camera_sources;
create policy camera_sources_update_staff
  on public.camera_sources for update to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

drop policy if exists camera_sources_delete_staff on public.camera_sources;
create policy camera_sources_delete_staff
  on public.camera_sources for delete to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

notify pgrst, 'reload schema';
