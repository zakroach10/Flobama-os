-- Artist-owned LED wall graphics, ad-roll default playlist, and auto-activation tracking.

alter table public.led_wall_scenes
  add column if not exists artist_id uuid references public.artists (id) on delete cascade;

create unique index if not exists led_wall_scenes_artist_uidx
  on public.led_wall_scenes (artist_id)
  where artist_id is not null;

alter table public.led_wall_scenes
  drop constraint if exists led_wall_scenes_artist_media_only;

alter table public.led_wall_scenes
  add constraint led_wall_scenes_artist_media_only check (
    artist_id is null or kind = 'media'
  );

alter table public.led_wall_settings
  add column if not exists default_playlist_id uuid references public.led_wall_playlists (id) on delete set null;

alter table public.led_wall_settings
  add column if not exists last_ad_roll_reset_on date;

alter table public.led_wall_runtime
  add column if not exists activation_source text not null default 'manual';

alter table public.led_wall_runtime
  drop constraint if exists led_wall_runtime_activation_source_check;

alter table public.led_wall_runtime
  add constraint led_wall_runtime_activation_source_check check (
    activation_source in ('manual', 'artist_auto', 'ad_roll')
  );

alter table public.led_wall_runtime
  add column if not exists auto_event_id uuid references public.events (id) on delete set null;

alter table public.led_wall_runtime
  add column if not exists auto_artist_id uuid references public.artists (id) on delete set null;

-- Managers (and admins) can manage artist-linked LED scenes from the artist profile.
drop policy if exists led_wall_scenes_insert_artist_manager on public.led_wall_scenes;
create policy led_wall_scenes_insert_artist_manager
  on public.led_wall_scenes for insert to authenticated
  with check (
    artist_id is not null
    and public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[])
  );

drop policy if exists led_wall_scenes_update_artist_manager on public.led_wall_scenes;
create policy led_wall_scenes_update_artist_manager
  on public.led_wall_scenes for update to authenticated
  using (
    artist_id is not null
    and public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[])
  )
  with check (
    artist_id is not null
    and public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[])
  );

drop policy if exists led_wall_scenes_delete_artist_manager on public.led_wall_scenes;
create policy led_wall_scenes_delete_artist_manager
  on public.led_wall_scenes for delete to authenticated
  using (
    artist_id is not null
    and public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[])
  );

-- All staff can read LED settings (ad-roll default); only admins write.
drop policy if exists led_wall_settings_select_admin on public.led_wall_settings;
drop policy if exists led_wall_settings_select_member on public.led_wall_settings;
create policy led_wall_settings_select_member
  on public.led_wall_settings for select to authenticated
  using (public.is_venue_member(venue_id));

notify pgrst, 'reload schema';
