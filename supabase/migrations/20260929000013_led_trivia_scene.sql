-- Add trivia enum value only.
-- PostgreSQL requires this value to be committed before it can be used in
-- constraints or inserts (see 20260929000015_led_trivia_scene_seed.sql).
-- In the Supabase SQL editor: run THIS file alone first, then run 00015.

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'led_wall_scene_kind'
      and e.enumlabel = 'trivia'
  ) then
    alter type public.led_wall_scene_kind add value 'trivia';
  end if;
end
$$;
