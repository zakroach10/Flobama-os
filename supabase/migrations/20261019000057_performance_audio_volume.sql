-- Performance Library: volume level + Server Station audio commands.

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    where t.typname = 'performance_command_kind'
      and e.enumlabel = 'set_audio_volume'
  ) then
    alter type public.performance_command_kind add value 'set_audio_volume';
  end if;
end
$$;

alter table public.performance_playback_state
  add column if not exists audio_volume double precision not null default 1
    check (audio_volume >= 0 and audio_volume <= 1);

comment on column public.performance_playback_state.audio_volume is
  'LED wall performance volume 0..1. audio_muted still silences output when true.';

notify pgrst, 'reload schema';
