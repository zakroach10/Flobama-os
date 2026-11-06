-- Per-pack trivia branding + redistribute seeded Shoals correct answers off all-A.

alter table public.trivia_packs
  add column if not exists brand_background text not null default '#1b1612'
    check (brand_background ~* '^#[0-9A-Fa-f]{6}$'),
  add column if not exists brand_text text not null default '#f7f1ea'
    check (brand_text ~* '^#[0-9A-Fa-f]{6}$'),
  add column if not exists brand_accent text not null default '#d36b4a'
    check (brand_accent ~* '^#[0-9A-Fa-f]{6}$'),
  add column if not exists brand_muted text not null default '#cbb7a8'
    check (brand_muted ~* '^#[0-9A-Fa-f]{6}$'),
  add column if not exists brand_muted_strong text not null default '#8a7368'
    check (brand_muted_strong ~* '^#[0-9A-Fa-f]{6}$'),
  add column if not exists brand_logo_path text,
  add column if not exists brand_logo_url text;

comment on column public.trivia_packs.brand_background is 'LED/phone trivia background hex';
comment on column public.trivia_packs.brand_accent is 'Accent / correct-highlight hex';
comment on column public.trivia_packs.brand_logo_url is 'Optional pack logo shown on wall/kiosk';

-- Reshuffle seeded Shoals pack so correct answers are not all letter A.
-- Facts stay the same; choice order and correct_index change.

update public.trivia_questions set
  choice_a = 'Sam Phillips',
  choice_b = 'Rick Hall',
  choice_c = 'Berry Gordy',
  choice_d = 'Ahmet Ertegun',
  correct_index = 1
where id = '22222222-2222-4222-8222-222222222201';

update public.trivia_questions set
  choice_a = 'The Funk Brothers',
  choice_b = 'Booker T. & the M.G.''s',
  choice_c = 'The Swampers',
  choice_d = 'The Wrecking Crew',
  correct_index = 2
where id = '22222222-2222-4222-8222-222222222202';

update public.trivia_questions set
  choice_a = 'Respect (original Detroit cut only)',
  choice_b = 'Think (live only)',
  choice_c = 'Natural Woman (NYC only)',
  choice_d = 'I Never Loved a Man (The Way I Love You)',
  correct_index = 3
where id = '22222222-2222-4222-8222-222222222203';

-- Wild Horses stays A (correct_index 0) — already factual.

update public.trivia_questions set
  choice_a = 'Stand by Me',
  choice_b = 'When a Man Loves a Woman',
  choice_c = 'My Girl',
  choice_d = 'Dock of the Bay',
  correct_index = 1
where id = '22222222-2222-4222-8222-222222222205';

-- FAME acronym stays A (correct_index 0).

update public.trivia_questions set
  choice_a = 'Dusty Springfield',
  choice_b = 'Tina Turner',
  choice_c = 'Etta James',
  choice_d = 'Diana Ross',
  correct_index = 2
where id = '22222222-2222-4222-8222-222222222207';

update public.trivia_questions set
  choice_a = 'Free Bird',
  choice_b = 'Gimme Three Steps',
  choice_c = 'Simple Man',
  choice_d = 'Sweet Home Alabama',
  correct_index = 3
where id = '22222222-2222-4222-8222-222222222208';

update public.trivia_questions set
  choice_a = 'In the Midnight Hour (original)',
  choice_b = 'Land of 1000 Dances',
  choice_c = 'Mustang Sally (only Detroit)',
  choice_d = 'Soul Man',
  correct_index = 1
where id = '22222222-2222-4222-8222-222222222209';

update public.trivia_questions set
  choice_a = 'Beale Street',
  choice_b = 'Music Row',
  choice_c = 'Jackson Highway',
  choice_d = 'Bourbon Street',
  correct_index = 2
where id = '22222222-2222-4222-8222-222222222210';

update public.trivia_questions set
  choice_a = 'Adele',
  choice_b = 'Amy Winehouse',
  choice_c = 'Ellie Goulding',
  choice_d = 'Dusty Springfield',
  correct_index = 3
where id = '22222222-2222-4222-8222-222222222211';

-- Hit Recording Capital stays A (correct_index 0).
