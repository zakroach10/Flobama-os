-- Venue computer-control login (Wall & Screens Chrome app). Set from Settings.

alter table public.venues
  add column if not exists wall_ops_user_id uuid references auth.users (id) on delete set null;

create index if not exists venues_wall_ops_user_id_idx
  on public.venues (wall_ops_user_id)
  where wall_ops_user_id is not null;

grant update (name, wall_ops_user_id) on public.venues to authenticated;

notify pgrst, 'reload schema';
