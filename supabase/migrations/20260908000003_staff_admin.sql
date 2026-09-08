-- Admin staff directory, membership writes, and last-admin protection.
-- Authenticated users still cannot self-promote: only admins write memberships.

create or replace function public.list_venue_staff(p_venue_id uuid)
returns table (
  user_id uuid,
  role public.staff_role,
  display_name text,
  email text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.user_id,
    m.role,
    coalesce(p.display_name, ''),
    u.email::text,
    m.created_at
  from public.venue_memberships m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = m.user_id
  where m.venue_id = p_venue_id
    and public.is_venue_member(p_venue_id)
  order by
    case m.role
      when 'admin' then 0
      when 'manager' then 1
      else 2
    end,
    coalesce(nullif(p.display_name, ''), u.email);
$$;

revoke all on function public.list_venue_staff(uuid) from public, anon, authenticated;
grant execute on function public.list_venue_staff(uuid) to authenticated;

create or replace function public.protect_last_venue_admin()
returns trigger
language plpgsql
as $$
declare
  remaining integer;
begin
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

drop trigger if exists venue_memberships_protect_last_admin on public.venue_memberships;
create trigger venue_memberships_protect_last_admin
  before update or delete on public.venue_memberships
  for each row execute function public.protect_last_venue_admin();

grant select, insert, update, delete on public.venue_memberships to authenticated;

drop policy if exists venue_memberships_select_self on public.venue_memberships;
drop policy if exists venue_memberships_select_member on public.venue_memberships;
create policy venue_memberships_select_member
  on public.venue_memberships
  for select
  to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists venue_memberships_insert_admin on public.venue_memberships;
create policy venue_memberships_insert_admin
  on public.venue_memberships
  for insert
  to authenticated
  with check (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));

drop policy if exists venue_memberships_update_admin on public.venue_memberships;
create policy venue_memberships_update_admin
  on public.venue_memberships
  for update
  to authenticated
  using (public.has_venue_role(venue_id, array['admin']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin', 'manager', 'viewer']::public.staff_role[]));

drop policy if exists venue_memberships_delete_admin on public.venue_memberships;
create policy venue_memberships_delete_admin
  on public.venue_memberships
  for delete
  to authenticated
  using (public.has_venue_role(venue_id, array['admin']::public.staff_role[]));

notify pgrst, 'reload schema';
