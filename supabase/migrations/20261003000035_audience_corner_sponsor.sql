-- Corner sponsor bug for the audience LED wall.
-- Shown over polls, questions, and the join lobby without replacing them.

alter table public.audience_venue_settings
  add column if not exists corner_sponsor_enabled boolean not null default false,
  add column if not exists corner_sponsor_name text,
  add column if not exists corner_sponsor_image_path text,
  add column if not exists corner_sponsor_image_url text,
  add column if not exists corner_sponsor_corner text not null default 'bottom-left';

alter table public.audience_venue_settings
  drop constraint if exists audience_venue_settings_corner_sponsor_corner;
alter table public.audience_venue_settings
  add constraint audience_venue_settings_corner_sponsor_corner
  check (corner_sponsor_corner in ('bottom-left', 'bottom-right'));

alter table public.audience_venue_settings
  drop constraint if exists audience_venue_settings_corner_sponsor_name_len;
alter table public.audience_venue_settings
  add constraint audience_venue_settings_corner_sponsor_name_len
  check (corner_sponsor_name is null or char_length(corner_sponsor_name) <= 80);

-- A stored file always has a public URL. A pinned sponsor may be URL-only.
alter table public.audience_venue_settings
  drop constraint if exists audience_venue_settings_corner_sponsor_image_pair;
alter table public.audience_venue_settings
  add constraint audience_venue_settings_corner_sponsor_image_pair
  check (
    corner_sponsor_image_path is null
    or corner_sponsor_image_url is not null
  );
