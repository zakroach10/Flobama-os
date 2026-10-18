-- Server Station slides wait until the current ad-roll ad finishes.
-- starts_at hides a Show Now override from playback until that moment.
-- resume_playlist_item_id is the ad that should start cleanly when the override ends.

alter table public.led_wall_overrides
  add column if not exists starts_at timestamptz not null default now();

alter table public.led_wall_overrides
  add column if not exists resume_playlist_item_id uuid;

create or replace view public.led_wall_override_listings
with (security_invoker = false)
as
select
  o.venue_id,
  o.scene_id,
  o.server_item_id,
  o.ends_at,
  o.updated_at,
  s.title,
  s.kind,
  s.media_kind,
  s.public_url,
  s.obs_scene_name,
  15 as duration_seconds,
  o.starts_at
from public.led_wall_overrides o
join public.led_wall_scenes s on s.id = o.scene_id
where s.enabled = true
  and o.starts_at <= now()
  and o.ends_at > now();

grant select on public.led_wall_override_listings to anon, authenticated;

notify pgrst, 'reload schema';
