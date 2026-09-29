-- Automated Shoals trivia: packs, sessions, temp players, answers.
-- Patrons join via cookie token through service-role APIs; anon never reads answer keys.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'trivia_session_status') then
    create type public.trivia_session_status as enum (
      'lobby',
      'question',
      'reveal',
      'podium',
      'final',
      'ended'
    );
  end if;
end
$$;

create table if not exists public.trivia_packs (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  theme text not null default 'Shoals music history'
    check (char_length(btrim(theme)) between 1 and 160),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trivia_packs_venue_idx
  on public.trivia_packs (venue_id, enabled);

drop trigger if exists trivia_packs_set_updated_at on public.trivia_packs;
create trigger trivia_packs_set_updated_at
  before update on public.trivia_packs
  for each row execute function public.set_updated_at();

create table if not exists public.trivia_questions (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.trivia_packs (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  prompt text not null check (char_length(btrim(prompt)) between 1 and 500),
  choice_a text not null check (char_length(btrim(choice_a)) between 1 and 200),
  choice_b text not null check (char_length(btrim(choice_b)) between 1 and 200),
  choice_c text not null check (char_length(btrim(choice_c)) between 1 and 200),
  choice_d text not null check (char_length(btrim(choice_d)) between 1 and 200),
  correct_index smallint not null check (correct_index between 0 and 3),
  points integer not null default 1000 check (points between 100 and 10000),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trivia_questions_pack_order_idx
  on public.trivia_questions (pack_id, sort_order);

drop trigger if exists trivia_questions_set_updated_at on public.trivia_questions;
create trigger trivia_questions_set_updated_at
  before update on public.trivia_questions
  for each row execute function public.set_updated_at();

create table if not exists public.trivia_sessions (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  pack_id uuid not null references public.trivia_packs (id) on delete restrict,
  join_code text not null check (char_length(join_code) between 4 and 8),
  status public.trivia_session_status not null default 'lobby',
  current_question_index integer not null default 0 check (current_question_index >= 0),
  question_count integer not null check (question_count between 1 and 50),
  phase_ends_at timestamptz,
  lobby_seconds integer not null default 60 check (lobby_seconds between 15 and 600),
  question_seconds integer not null default 20 check (question_seconds between 8 and 120),
  reveal_seconds integer not null default 6 check (reveal_seconds between 3 and 60),
  podium_seconds integer not null default 8 check (podium_seconds between 3 and 60),
  final_seconds integer not null default 90 check (final_seconds between 15 and 600),
  started_by uuid references auth.users (id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trivia_sessions_join_code_unique unique (join_code)
);

create index if not exists trivia_sessions_venue_active_idx
  on public.trivia_sessions (venue_id, status)
  where status <> 'ended';

drop trigger if exists trivia_sessions_set_updated_at on public.trivia_sessions;
create trigger trivia_sessions_set_updated_at
  before update on public.trivia_sessions
  for each row execute function public.set_updated_at();

create table if not exists public.trivia_session_questions (
  session_id uuid not null references public.trivia_sessions (id) on delete cascade,
  question_index integer not null check (question_index >= 0),
  question_id uuid not null references public.trivia_questions (id) on delete restrict,
  prompt text not null,
  choice_a text not null,
  choice_b text not null,
  choice_c text not null,
  choice_d text not null,
  correct_index smallint not null check (correct_index between 0 and 3),
  points integer not null,
  primary key (session_id, question_index)
);

create table if not exists public.trivia_players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.trivia_sessions (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 24),
  player_token text not null unique check (char_length(player_token) between 20 and 80),
  score integer not null default 0 check (score >= 0),
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trivia_players_session_score_idx
  on public.trivia_players (session_id, score desc, joined_at);

drop trigger if exists trivia_players_set_updated_at on public.trivia_players;
create trigger trivia_players_set_updated_at
  before update on public.trivia_players
  for each row execute function public.set_updated_at();

create table if not exists public.trivia_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.trivia_sessions (id) on delete cascade,
  player_id uuid not null references public.trivia_players (id) on delete cascade,
  question_index integer not null check (question_index >= 0),
  choice_index smallint not null check (choice_index between 0 and 3),
  correct boolean not null,
  points_awarded integer not null default 0 check (points_awarded >= 0),
  response_ms integer not null check (response_ms >= 0),
  answered_at timestamptz not null default now(),
  constraint trivia_answers_one_per_player unique (session_id, player_id, question_index)
);

create index if not exists trivia_answers_session_q_idx
  on public.trivia_answers (session_id, question_index);

-- Seed Shoals music history pack for FloBama.
insert into public.trivia_packs (id, venue_id, title, theme, enabled)
values (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'Shoals Music History',
  'Shoals music history',
  true
)
on conflict (id) do nothing;

insert into public.trivia_questions (
  id, pack_id, venue_id, prompt, choice_a, choice_b, choice_c, choice_d, correct_index, points, sort_order
)
values
  (
    '22222222-2222-4222-8222-222222222201',
    '22222222-2222-4222-8222-222222222222',
    '11111111-1111-4111-8111-111111111111',
    'Who founded FAME Studios in Muscle Shoals?',
    'Rick Hall',
    'Sam Phillips',
    'Berry Gordy',
    'Ahmet Ertegun',
    0,
    1000,
    0
  ),
  (
    '22222222-2222-4222-8222-222222222202',
    '22222222-2222-4222-8222-222222222222',
    '11111111-1111-4111-8111-111111111111',
    'Muscle Shoals Sound Studio was started by which house band?',
    'The Swampers',
    'The Funk Brothers',
    'Booker T. & the M.G.''s',
    'The Wrecking Crew',
    0,
    1000,
    1
  ),
  (
    '22222222-2222-4222-8222-222222222203',
    '22222222-2222-4222-8222-222222222222',
    '11111111-1111-4111-8111-111111111111',
    'Which Aretha Franklin hit was cut in Muscle Shoals?',
    'I Never Loved a Man (The Way I Love You)',
    'Respect (original Detroit cut only)',
    'Think (live only)',
    'Natural Woman (NYC only)',
    0,
    1000,
    2
  ),
  (
    '22222222-2222-4222-8222-222222222204',
    '22222222-2222-4222-8222-222222222222',
    '11111111-1111-4111-8111-111111111111',
    'The Rolling Stones recorded which classic at Muscle Shoals Sound?',
    'Wild Horses',
    'Satisfaction',
    'Paint It Black',
    'Angie',
    0,
    1000,
    3
  ),
  (
    '22222222-2222-4222-8222-222222222205',
    '22222222-2222-4222-8222-222222222222',
    '11111111-1111-4111-8111-111111111111',
    'Percy Sledge''s breakthrough hit tied to the Shoals scene was?',
    'When a Man Loves a Woman',
    'Stand by Me',
    'My Girl',
    'Dock of the Bay',
    0,
    1000,
    4
  ),
  (
    '22222222-2222-4222-8222-222222222206',
    '22222222-2222-4222-8222-222222222222',
    '11111111-1111-4111-8111-111111111111',
    'FAME originally stood for?',
    'Florence Alabama Music Enterprises',
    'Famous American Music Exchange',
    'Federal Audio Mixing Engineers',
    'First Avenue Music Ensemble',
    0,
    1000,
    5
  ),
  (
    '22222222-2222-4222-8222-222222222207',
    '22222222-2222-4222-8222-222222222222',
    '11111111-1111-4111-8111-111111111111',
    'Which singer cut "I''d Rather Go Blind" sessions linked to the Shoals?',
    'Etta James',
    'Dusty Springfield',
    'Tina Turner',
    'Diana Ross',
    0,
    1000,
    6
  ),
  (
    '22222222-2222-4222-8222-222222222208',
    '22222222-2222-4222-8222-222222222222',
    '11111111-1111-4111-8111-111111111111',
    'Lynyrd Skynyrd name-checked the local players in which song?',
    'Sweet Home Alabama',
    'Free Bird',
    'Gimme Three Steps',
    'Simple Man',
    0,
    1000,
    7
  ),
  (
    '22222222-2222-4222-8222-222222222209',
    '22222222-2222-4222-8222-222222222222',
    '11111111-1111-4111-8111-111111111111',
    'Wilson Pickett recorded which hit at FAME?',
    'Land of 1000 Dances',
    'In the Midnight Hour (original)',
    'Mustang Sally (only Detroit)',
    'Soul Man',
    0,
    1000,
    8
  ),
  (
    '22222222-2222-4222-8222-222222222210',
    '22222222-2222-4222-8222-222222222222',
    '11111111-1111-4111-8111-111111111111',
    'Muscle Shoals Sound Studio''s famous early address was on?',
    'Jackson Highway',
    'Beale Street',
    'Music Row',
    'Bourbon Street',
    0,
    1000,
    9
  ),
  (
    '22222222-2222-4222-8222-222222222211',
    '22222222-2222-4222-8222-222222222222',
    '11111111-1111-4111-8111-111111111111',
    'Which British soul singer famously recorded in Muscle Shoals?',
    'Dusty Springfield',
    'Adele',
    'Amy Winehouse',
    'Ellie Goulding',
    0,
    1000,
    10
  ),
  (
    '22222222-2222-4222-8222-222222222212',
    '22222222-2222-4222-8222-222222222222',
    '11111111-1111-4111-8111-111111111111',
    'The Shoals recording scene is often nicknamed?',
    'The Hit Recording Capital of the World',
    'Motown West',
    'Sun City South',
    'The Nashville Spur',
    0,
    1000,
    11
  )
on conflict (id) do nothing;

alter table public.trivia_packs enable row level security;
alter table public.trivia_packs force row level security;
alter table public.trivia_questions enable row level security;
alter table public.trivia_questions force row level security;
alter table public.trivia_sessions enable row level security;
alter table public.trivia_sessions force row level security;
alter table public.trivia_session_questions enable row level security;
alter table public.trivia_session_questions force row level security;
alter table public.trivia_players enable row level security;
alter table public.trivia_players force row level security;
alter table public.trivia_answers enable row level security;
alter table public.trivia_answers force row level security;

revoke all on public.trivia_packs from anon, public, authenticated;
revoke all on public.trivia_questions from anon, public, authenticated;
revoke all on public.trivia_sessions from anon, public, authenticated;
revoke all on public.trivia_session_questions from anon, public, authenticated;
revoke all on public.trivia_players from anon, public, authenticated;
revoke all on public.trivia_answers from anon, public, authenticated;

grant select, insert, update, delete on public.trivia_packs to authenticated;
grant select, insert, update, delete on public.trivia_questions to authenticated;
grant select, insert, update, delete on public.trivia_sessions to authenticated;
grant select, insert, update, delete on public.trivia_session_questions to authenticated;
grant select on public.trivia_players to authenticated;
grant select on public.trivia_answers to authenticated;

drop policy if exists trivia_packs_select_member on public.trivia_packs;
create policy trivia_packs_select_member
  on public.trivia_packs for select to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists trivia_packs_write_managers on public.trivia_packs;
create policy trivia_packs_write_managers
  on public.trivia_packs for all to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

drop policy if exists trivia_questions_select_member on public.trivia_questions;
create policy trivia_questions_select_member
  on public.trivia_questions for select to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists trivia_questions_write_managers on public.trivia_questions;
create policy trivia_questions_write_managers
  on public.trivia_questions for all to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]))
  with check (public.has_venue_role(venue_id, array['admin', 'manager']::public.staff_role[]));

drop policy if exists trivia_sessions_select_member on public.trivia_sessions;
create policy trivia_sessions_select_member
  on public.trivia_sessions for select to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists trivia_sessions_write_staff on public.trivia_sessions;
create policy trivia_sessions_write_staff
  on public.trivia_sessions for all to authenticated
  using (public.is_venue_member(venue_id))
  with check (public.is_venue_member(venue_id));

drop policy if exists trivia_session_questions_select_member on public.trivia_session_questions;
create policy trivia_session_questions_select_member
  on public.trivia_session_questions for select to authenticated
  using (
    exists (
      select 1 from public.trivia_sessions s
      where s.id = session_id and public.is_venue_member(s.venue_id)
    )
  );

drop policy if exists trivia_session_questions_write_staff on public.trivia_session_questions;
create policy trivia_session_questions_write_staff
  on public.trivia_session_questions for all to authenticated
  using (
    exists (
      select 1 from public.trivia_sessions s
      where s.id = session_id and public.is_venue_member(s.venue_id)
    )
  )
  with check (
    exists (
      select 1 from public.trivia_sessions s
      where s.id = session_id and public.is_venue_member(s.venue_id)
    )
  );

drop policy if exists trivia_players_select_member on public.trivia_players;
create policy trivia_players_select_member
  on public.trivia_players for select to authenticated
  using (public.is_venue_member(venue_id));

drop policy if exists trivia_answers_select_member on public.trivia_answers;
create policy trivia_answers_select_member
  on public.trivia_answers for select to authenticated
  using (
    exists (
      select 1 from public.trivia_sessions s
      where s.id = session_id and public.is_venue_member(s.venue_id)
    )
  );

-- Public wall snapshot (no correct answers until reveal/podium/final).
create or replace view public.trivia_wall_listings
with (security_invoker = false)
as
select
  s.id as session_id,
  s.venue_id,
  s.join_code,
  s.status,
  s.current_question_index,
  s.question_count,
  s.phase_ends_at,
  s.lobby_seconds,
  s.question_seconds,
  s.reveal_seconds,
  s.podium_seconds,
  s.final_seconds,
  s.started_at,
  p.title as pack_title,
  p.theme as pack_theme,
  (
    select count(*)::integer
    from public.trivia_players pl
    where pl.session_id = s.id
  ) as player_count
from public.trivia_sessions s
join public.trivia_packs p on p.id = s.pack_id
where s.status <> 'ended';

revoke all on public.trivia_wall_listings from anon, public, authenticated;
grant select on public.trivia_wall_listings to anon, authenticated;
