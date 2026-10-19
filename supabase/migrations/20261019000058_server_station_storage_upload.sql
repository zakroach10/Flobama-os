-- Server Station staff (including servers) need to upload LED graphics into screen-ads.
-- Paths are always "{venue_id}/led/server-…". Managers/admins keep full bucket access
-- via the existing screen_ads_objects_* policies.

drop policy if exists screen_ads_objects_insert_server_station on storage.objects;
create policy screen_ads_objects_insert_server_station
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'screen-ads'
    and name ~ '^[0-9a-f-]{36}/led/server-'
    and public.has_venue_role(
      (split_part(name, '/', 1))::uuid,
      array['admin', 'manager', 'server']::public.staff_role[]
    )
  );

drop policy if exists screen_ads_objects_update_server_station on storage.objects;
create policy screen_ads_objects_update_server_station
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'screen-ads'
    and name ~ '^[0-9a-f-]{36}/led/server-'
    and public.has_venue_role(
      (split_part(name, '/', 1))::uuid,
      array['admin', 'manager', 'server']::public.staff_role[]
    )
  )
  with check (
    bucket_id = 'screen-ads'
    and name ~ '^[0-9a-f-]{36}/led/server-'
    and public.has_venue_role(
      (split_part(name, '/', 1))::uuid,
      array['admin', 'manager', 'server']::public.staff_role[]
    )
  );

notify pgrst, 'reload schema';
