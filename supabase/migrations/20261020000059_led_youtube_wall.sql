-- YouTube one-shot takes on the LED wall (Server Station → wall link).
-- Enum value must be committed before any CHECK / row uses it (Postgres 55P04).
-- Constraints that reference 'youtube' live in 20261020000060_led_youtube_wall_constraints.sql.

alter type public.screen_media_kind add value if not exists 'youtube';
