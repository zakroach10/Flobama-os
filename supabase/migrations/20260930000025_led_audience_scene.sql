-- Add audience enum value for LED wall scenes.
-- Run alone before 20260930000026_led_audience_scene_seed.sql.

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'led_wall_scene_kind'
      and e.enumlabel = 'audience'
  ) then
    alter type public.led_wall_scene_kind add value 'audience';
  end if;
end
$$;
