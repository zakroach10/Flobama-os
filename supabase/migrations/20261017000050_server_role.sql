-- Add server staff role only.
-- PostgreSQL requires this value to be committed before policies can use it
-- (see 20261017000051_server_station.sql).
-- In the Supabase SQL editor: run THIS file alone first, then 00051.

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'staff_role'
      and e.enumlabel = 'server'
  ) then
    alter type public.staff_role add value 'server';
  end if;
end
$$;
