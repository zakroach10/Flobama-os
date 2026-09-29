-- Allow staff to delete camera_sources, and remember dismissed/hidden source keys
-- so the Mac connector does not immediately re-create them after delete.

grant insert, update, delete on public.camera_sources to authenticated;

create table if not exists public.camera_hidden_sources (
  venue_id uuid not null references public.venues (id) on delete cascade,
  source_key text not null check (char_length(btrim(source_key)) between 1 and 200),
  hidden_at timestamptz not null default now(),
  hidden_by uuid references auth.users (id) on delete set null,
  primary key (venue_id, source_key)
);

create index if not exists camera_hidden_sources_venue_idx
  on public.camera_hidden_sources (venue_id);

alter table public.camera_hidden_sources enable row level security;
alter table public.camera_hidden_sources force row level security;

revoke all on public.camera_hidden_sources from anon, public, authenticated;
grant select, insert, update, delete on public.camera_hidden_sources to authenticated;

drop policy if exists camera_hidden_select_member on public.camera_hidden_sources;
create policy camera_hidden_select_member
  on public.camera_hidden_sources for select to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists camera_hidden_write_staff on public.camera_hidden_sources;
create policy camera_hidden_write_staff
  on public.camera_hidden_sources for all to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

notify pgrst, 'reload schema';
