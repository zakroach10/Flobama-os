-- Live Audience Interactor: staff role + session tools for the LED wall.
-- Guests join via cookie token through service-role APIs (same pattern as trivia).

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

do $$
begin
  if not exists (select 1 from pg_type where typname = 'audience_session_status') then
    create type public.audience_session_status as enum ('live', 'ended');
  end if;
  if not exists (select 1 from pg_type where typname = 'audience_tool_kind') then
    create type public.audience_tool_kind as enum (
      'poll',
      'host_picks',
      'questions',
      'hot_take',
      'message',
      'matchup',
      'pickem_promo',
      'leaderboard',
      'sponsor',
      'countdown'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'audience_tool_status') then
    create type public.audience_tool_status as enum ('ready', 'on_wall', 'archived');
  end if;
  if not exists (select 1 from pg_type where typname = 'audience_question_status') then
    create type public.audience_question_status as enum ('pending', 'approved', 'on_wall', 'rejected', 'done');
  end if;
end
$$;

create table if not exists public.audience_sessions (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  title text not null default 'Live show'
    check (char_length(btrim(title)) between 1 and 160),
  join_code text not null check (char_length(join_code) between 4 and 8),
  status public.audience_session_status not null default 'live',
  active_tool_id uuid,
  voting_open boolean not null default true,
  results_revealed boolean not null default false,
  started_by uuid references auth.users (id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint audience_sessions_join_code_unique unique (join_code)
);

create index if not exists audience_sessions_venue_live_idx
  on public.audience_sessions (venue_id, status)
  where status = 'live';

drop trigger if exists audience_sessions_set_updated_at on public.audience_sessions;
create trigger audience_sessions_set_updated_at
  before update on public.audience_sessions
  for each row execute function public.set_updated_at();

create table if not exists public.audience_tools (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.audience_sessions (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  kind public.audience_tool_kind not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  status public.audience_tool_status not null default 'ready',
  payload jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists audience_tools_session_idx
  on public.audience_tools (session_id, sort_order, created_at);

drop trigger if exists audience_tools_set_updated_at on public.audience_tools;
create trigger audience_tools_set_updated_at
  before update on public.audience_tools
  for each row execute function public.set_updated_at();

-- Deferred FK so tools can be created before session.active_tool_id points at them.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'audience_sessions_active_tool_fkey'
  ) then
    alter table public.audience_sessions
      add constraint audience_sessions_active_tool_fkey
      foreign key (active_tool_id) references public.audience_tools (id) on delete set null;
  end if;
end
$$;

create table if not exists public.audience_guests (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.audience_sessions (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 24),
  guest_token text not null unique check (char_length(guest_token) between 20 and 80),
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists audience_guests_session_idx
  on public.audience_guests (session_id, joined_at);

drop trigger if exists audience_guests_set_updated_at on public.audience_guests;
create trigger audience_guests_set_updated_at
  before update on public.audience_guests
  for each row execute function public.set_updated_at();

create table if not exists public.audience_votes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.audience_sessions (id) on delete cascade,
  tool_id uuid not null references public.audience_tools (id) on delete cascade,
  guest_id uuid not null references public.audience_guests (id) on delete cascade,
  choice_key text not null check (char_length(btrim(choice_key)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint audience_votes_unique_guest_tool unique (tool_id, guest_id)
);

create index if not exists audience_votes_tool_idx
  on public.audience_votes (tool_id, choice_key);

drop trigger if exists audience_votes_set_updated_at on public.audience_votes;
create trigger audience_votes_set_updated_at
  before update on public.audience_votes
  for each row execute function public.set_updated_at();

create table if not exists public.audience_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.audience_sessions (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  guest_id uuid references public.audience_guests (id) on delete set null,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 24),
  body text not null check (char_length(btrim(body)) between 1 and 280),
  status public.audience_question_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists audience_questions_session_status_idx
  on public.audience_questions (session_id, status, created_at);

drop trigger if exists audience_questions_set_updated_at on public.audience_questions;
create trigger audience_questions_set_updated_at
  before update on public.audience_questions
  for each row execute function public.set_updated_at();

alter table public.audience_sessions enable row level security;
alter table public.audience_sessions force row level security;
alter table public.audience_tools enable row level security;
alter table public.audience_tools force row level security;
alter table public.audience_guests enable row level security;
alter table public.audience_guests force row level security;
alter table public.audience_votes enable row level security;
alter table public.audience_votes force row level security;
alter table public.audience_questions enable row level security;
alter table public.audience_questions force row level security;

revoke all on public.audience_sessions from anon, public, authenticated;
revoke all on public.audience_tools from anon, public, authenticated;
revoke all on public.audience_guests from anon, public, authenticated;
revoke all on public.audience_votes from anon, public, authenticated;
revoke all on public.audience_questions from anon, public, authenticated;

grant select, insert, update, delete on public.audience_sessions to authenticated;
grant select, insert, update, delete on public.audience_tools to authenticated;
grant select on public.audience_guests to authenticated;
grant select on public.audience_votes to authenticated;
grant select, update on public.audience_questions to authenticated;

-- Staff: admin, manager, interactor can run audience tools.
drop policy if exists audience_sessions_select_runner on public.audience_sessions;
create policy audience_sessions_select_runner
  on public.audience_sessions for select to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager', 'interactor']::public.staff_role[]));

drop policy if exists audience_sessions_write_runner on public.audience_sessions;
create policy audience_sessions_write_runner
  on public.audience_sessions for all to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager', 'interactor']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin', 'manager', 'interactor']::public.staff_role[]));

drop policy if exists audience_tools_select_runner on public.audience_tools;
create policy audience_tools_select_runner
  on public.audience_tools for select to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager', 'interactor']::public.staff_role[]));

drop policy if exists audience_tools_write_runner on public.audience_tools;
create policy audience_tools_write_runner
  on public.audience_tools for all to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager', 'interactor']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin', 'manager', 'interactor']::public.staff_role[]));

drop policy if exists audience_guests_select_runner on public.audience_guests;
create policy audience_guests_select_runner
  on public.audience_guests for select to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager', 'interactor']::public.staff_role[]));

drop policy if exists audience_votes_select_runner on public.audience_votes;
create policy audience_votes_select_runner
  on public.audience_votes for select to authenticated
  using (
    exists (
      select 1 from public.audience_sessions s
      where s.id = session_id
        and public.has_venue_role(s.venue_id, array['admin', 'manager', 'interactor']::public.staff_role[])
    )
  );

drop policy if exists audience_questions_select_runner on public.audience_questions;
create policy audience_questions_select_runner
  on public.audience_questions for select to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager', 'interactor']::public.staff_role[]));

drop policy if exists audience_questions_update_runner on public.audience_questions;
create policy audience_questions_update_runner
  on public.audience_questions for update to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager', 'interactor']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin', 'manager', 'interactor']::public.staff_role[]));
