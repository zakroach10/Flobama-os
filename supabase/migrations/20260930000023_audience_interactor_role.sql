-- Add interactor staff role only.
-- PostgreSQL requires this value to be committed before policies can use it
-- (see 20260930000024_audience_interactor_tables.sql).
-- In the Supabase SQL editor: run THIS file alone first, then 00024.

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'staff_role'
      and e.enumlabel = 'interactor'
  ) then
    alter type public.staff_role add value 'interactor';
  end if;
end
$$;
