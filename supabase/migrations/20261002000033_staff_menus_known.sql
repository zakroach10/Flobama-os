-- Refresh the allowed sidebar menu ids.
-- Older hosted DBs still have venue_memberships_menus_known with `events` and
-- without `programming`, `audience`, or `cameras`, which rejects staff inserts.

-- Map any saved legacy id before tightening the check.
update public.venue_memberships
set menus = (
  select array_agg(
    case when menu_id = 'events' then 'programming' else menu_id end
    order by ordinality
  )
  from unnest(menus) with ordinality as t(menu_id, ordinality)
)
where menus is not null
  and 'events' = any (menus);

alter table public.venue_memberships
  drop constraint if exists venue_memberships_menus_known;

alter table public.venue_memberships
  add constraint venue_memberships_menus_known
  check (
    menus is null
    or menus <@ array[
      'dashboard',
      'programming',
      'booking',
      'social',
      'audience',
      'screens',
      'cameras',
      'ticketing',
      'spoton',
      'artists',
      'settings'
    ]::text[]
  );

create or replace function public.protect_last_venue_admin()
returns trigger
language plpgsql
as $$
declare
  remaining integer;
  every_menu text[] := array[
    'dashboard',
    'programming',
    'booking',
    'social',
    'audience',
    'screens',
    'cameras',
    'ticketing',
    'spoton',
    'artists',
    'settings'
  ];
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

  if tg_op = 'UPDATE'
    and public.is_master_admin_user(new.user_id)
    and new.menus is not null
    and not (new.menus @> every_menu and every_menu @> new.menus)
  then
    raise exception 'the master admin keeps every menu';
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
