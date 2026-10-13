-- Staff toggle to disable hosted public LED / vertical browser players
-- (stops OBS tabs pointed at /display/* from streaming Supabase media).
-- Local Runner agent APIs are unaffected.

alter table public.screen_display_signals
  add column if not exists hosted_led_public_enabled boolean not null default true;

alter table public.screen_display_signals
  add column if not exists hosted_vertical_public_enabled boolean not null default true;

create or replace view public.screen_display_signal_listings
with (security_invoker = false)
as
select
  venue_id,
  reload_nonce,
  reload_requested_at,
  hosted_led_public_enabled,
  hosted_vertical_public_enabled
from public.screen_display_signals;

revoke all on public.screen_display_signal_listings from anon, public, authenticated;
grant select on public.screen_display_signal_listings to anon, authenticated;

notify pgrst, 'reload schema';
