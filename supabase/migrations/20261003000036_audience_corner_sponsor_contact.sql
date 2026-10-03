-- Phone number and optional message under the corner sponsor card.

alter table public.audience_venue_settings
  add column if not exists corner_sponsor_phone text,
  add column if not exists corner_sponsor_message text;

alter table public.audience_venue_settings
  drop constraint if exists audience_venue_settings_corner_sponsor_phone_len;
alter table public.audience_venue_settings
  add constraint audience_venue_settings_corner_sponsor_phone_len
  check (corner_sponsor_phone is null or char_length(corner_sponsor_phone) <= 40);

alter table public.audience_venue_settings
  drop constraint if exists audience_venue_settings_corner_sponsor_message_len;
alter table public.audience_venue_settings
  add constraint audience_venue_settings_corner_sponsor_message_len
  check (corner_sponsor_message is null or char_length(corner_sponsor_message) <= 120);
