-- Display names are unique inside one audience session, not across a venue.
--
-- Guest rows are kept after a session ends, and a device keeps one guest_token
-- for the life of its cookie. A venue-wide or global unique name would reject
-- a name that was only used on a previous night. Uniqueness is (session_id, name_key).
-- The same token may keep or reclaim its own name. Case and extra spaces match.

-- Later duplicates in the same session get a numeric suffix so the unique index can build.
-- The earliest join keeps the name it already had.
with ranked as (
  select
    id,
    row_number() over (
      partition by
        session_id,
        lower(regexp_replace(btrim(display_name), '[[:space:]]+', ' ', 'g'))
      order by joined_at, created_at, id
    ) as rn
  from public.audience_guests
)
update public.audience_guests as guest
set display_name = left(
  regexp_replace(btrim(guest.display_name), '[[:space:]]+', ' ', 'g') || ' ' || ranked.rn::text,
  24
)
from ranked
where guest.id = ranked.id
  and ranked.rn > 1;

do $$
begin
  if exists (
    select 1
    from public.audience_guests
    group by
      session_id,
      lower(regexp_replace(btrim(display_name), '[[:space:]]+', ' ', 'g'))
    having count(*) > 1
  ) then
    raise exception 'audience guest display names still collide inside a session';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'audience_guests'
      and column_name = 'name_key'
  ) then
    alter table public.audience_guests
      add column name_key text
      generated always as (
        lower(regexp_replace(btrim(display_name), '[[:space:]]+', ' ', 'g'))
      ) stored;
  end if;
end
$$;

create unique index if not exists audience_guests_session_name_key_uidx
  on public.audience_guests (session_id, name_key);

comment on column public.audience_guests.name_key is
  'Normalized display name. Unique together with session_id. Other sessions do not reserve it.';
