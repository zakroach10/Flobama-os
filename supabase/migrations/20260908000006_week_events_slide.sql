-- Dynamic "this week" kiosk slide. Anonymous role still cannot read screen_ads.

alter type public.screen_media_kind add value if not exists 'week_events';

alter table public.screen_ads drop constraint if exists screen_ads_storage_path_check;
alter table public.screen_ads drop constraint if exists screen_ads_public_url_check;

alter table public.screen_ads
  add constraint screen_ads_storage_path_check
  check (
    (char_length(storage_path) = 0 and public_url like 'dynamic:%')
    or char_length(storage_path) between 1 and 500
  );

alter table public.screen_ads
  add constraint screen_ads_public_url_check
  check (char_length(public_url) between 1 and 800);

alter table public.screen_ads
  drop constraint if exists screen_ads_week_duration_required;
alter table public.screen_ads
  add constraint screen_ads_week_duration_required
  check (media_kind::text <> 'week_events' or duration_seconds is not null);

notify pgrst, 'reload schema';
