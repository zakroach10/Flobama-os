-- Pin zak@view360.marketing as the FloBama OS master admin.
-- Other admins cannot remove or demote this login from venue_memberships.

create or replace function public.master_admin_email()
returns text
language sql
immutable
as $$
  select 'zak@view360.marketing'::text;
$$;

create or replace function public.is_master_admin_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = p_user_id
      and lower(u.email) = public.master_admin_email()
  );
$$;

revoke all on function public.master_admin_email() from public, anon, authenticated;
revoke all on function public.is_master_admin_user(uuid) from public, anon, authenticated;
grant execute on function public.is_master_admin_user(uuid) to authenticated;

create or replace function public.protect_last_venue_admin()
returns trigger
language plpgsql
as $$
declare
  remaining integer;
begin
  if public.is_master_admin_user(old.user_id) then
    if tg_op = 'DELETE' then
      raise exception 'the master admin cannot be removed';
    end if;
    if tg_op = 'UPDATE' and (new.role is distinct from 'admin' or new.user_id is distinct from old.user_id) then
      raise exception 'the master admin cannot be demoted or reassigned';
    end if;
  end if;

  if tg_op = 'DELETE' then
    if old.role = 'admin' then
      select count(*) into remaining
      from public.venue_memberships
      where venue_id = old.venue_id
        and role = 'admin'
        and user_id <> old.user_id;
      if remaining = 0 then
        raise exception 'cannot remove the last admin for this venue';
      end if;
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.role = 'admin' and new.role is distinct from 'admin' then
    select count(*) into remaining
    from public.venue_memberships
    where venue_id = old.venue_id
      and role = 'admin'
      and user_id <> old.user_id;
    if remaining = 0 then
      raise exception 'cannot demote the last admin for this venue';
    end if;
  end if;

  return new;
end;
$$;

insert into public.profiles (id, display_name)
select u.id, coalesce(nullif(u.raw_user_meta_data->>'display_name', ''), 'Zakary')
from auth.users u
where lower(u.email) = public.master_admin_email()
on conflict (id) do update
set display_name = excluded.display_name;

insert into public.venue_memberships (venue_id, user_id, role)
select
  '11111111-1111-4111-8111-111111111111'::uuid,
  u.id,
  'admin'::public.staff_role
from auth.users u
where lower(u.email) = public.master_admin_email()
on conflict (venue_id, user_id) do update
set role = 'admin';

notify pgrst, 'reload schema';
