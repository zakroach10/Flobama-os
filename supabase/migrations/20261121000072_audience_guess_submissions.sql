-- Guess submissions for Audience Interactor.
-- Correctness is decided here, under a row lock, so two phones cannot both win.

create table if not exists public.audience_guess_submissions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.audience_sessions (id) on delete cascade,
  tool_id uuid not null references public.audience_tools (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  guest_id uuid not null references public.audience_guests (id) on delete cascade,
  round_key text not null check (char_length(btrim(round_key)) between 1 and 80),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 24),
  answer text not null check (char_length(answer) between 1 and 160),
  correct boolean not null,
  won boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists audience_guess_one_winner_idx
  on public.audience_guess_submissions (tool_id, round_key)
  where won;

create index if not exists audience_guess_round_idx
  on public.audience_guess_submissions (tool_id, round_key, created_at desc);

alter table public.audience_guess_submissions enable row level security;
alter table public.audience_guess_submissions force row level security;

revoke all on public.audience_guess_submissions from anon, public, authenticated;
grant select on public.audience_guess_submissions to authenticated;

drop policy if exists audience_guess_select_runner on public.audience_guess_submissions;
create policy audience_guess_select_runner
  on public.audience_guess_submissions for select to authenticated
  using (public.has_venue_role(venue_id, array['admin', 'manager', 'interactor']::public.staff_role[]));

-- Trim ends only. Internal spaces stay so the match can be exact.
create or replace function public.audience_guess_trim(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select regexp_replace(coalesce(p_value, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
$$;

revoke all on function public.audience_guess_trim(text) from public, anon, authenticated;
grant execute on function public.audience_guess_trim(text) to service_role;

create or replace function public.submit_audience_guess(p_guest_token text, p_answer text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest public.audience_guests;
  v_session public.audience_sessions;
  v_tool public.audience_tools;
  v_round text;
  v_expected text;
  v_submitted text;
  v_correct boolean;
  v_id uuid;
  v_recent integer;
begin
  if p_guest_token is null or char_length(p_guest_token) < 20 then
    return jsonb_build_object('ok', false, 'error', 'Join the show first.');
  end if;

  v_submitted := public.audience_guess_trim(p_answer);
  if char_length(v_submitted) < 1 or char_length(v_submitted) > 160 then
    return jsonb_build_object('ok', false, 'error', 'Enter a guess.');
  end if;

  select * into v_guest
  from public.audience_guests
  where guest_token = p_guest_token;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Join the show first.');
  end if;

  select * into v_session
  from public.audience_sessions
  where id = v_guest.session_id
    and status = 'live'
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'That show is not live.');
  end if;

  if not v_session.voting_open then
    return jsonb_build_object('ok', false, 'error', 'Guessing is closed.');
  end if;

  if v_session.active_tool_id is null then
    return jsonb_build_object('ok', false, 'error', 'Nothing to guess right now.');
  end if;

  select * into v_tool
  from public.audience_tools
  where id = v_session.active_tool_id
    and session_id = v_session.id
    and status = 'on_wall'
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Nothing to guess right now.');
  end if;

  if v_tool.kind::text = 'guess_player' then
    v_round := nullif(public.audience_guess_trim(v_tool.payload->>'activePlayerId'), '');
    select nullif(public.audience_guess_trim(p->>'name'), '')
      into v_expected
    from jsonb_array_elements(coalesce(v_tool.payload->'players', '[]'::jsonb)) as p
    where p->>'id' = v_round
    limit 1;
  elsif v_tool.kind::text = 'guess_lyric' then
    v_round := nullif(public.audience_guess_trim(v_tool.payload->>'roundId'), '');
    v_expected := nullif(public.audience_guess_trim(v_tool.payload->>'answer'), '');
  else
    return jsonb_build_object('ok', false, 'error', 'This screen is not a guess game.');
  end if;

  if v_round is null or v_expected is null then
    return jsonb_build_object('ok', false, 'error', 'This round is not ready.');
  end if;

  if char_length(v_round) > 80 then
    return jsonb_build_object('ok', false, 'error', 'This round is not ready.');
  end if;

  if exists (
    select 1
    from public.audience_guess_submissions
    where tool_id = v_tool.id
      and round_key = v_round
      and won
  ) then
    return jsonb_build_object('ok', false, 'error', 'Someone already got it.');
  end if;

  if exists (
    select 1
    from public.audience_guess_submissions
    where tool_id = v_tool.id
      and round_key = v_round
      and guest_id = v_guest.id
      and created_at > now() - interval '1.2 seconds'
  ) then
    return jsonb_build_object('ok', false, 'error', 'Slow down a second and try again.');
  end if;

  select count(*) into v_recent
  from public.audience_guess_submissions
  where tool_id = v_tool.id
    and round_key = v_round
    and guest_id = v_guest.id;

  if v_recent >= 40 then
    return jsonb_build_object('ok', false, 'error', 'That is enough guesses for this one.');
  end if;

  -- Exact match after the trim above. Capitalization, punctuation, and internal spaces count.
  v_correct := v_submitted = v_expected;

  insert into public.audience_guess_submissions (
    session_id,
    tool_id,
    venue_id,
    guest_id,
    round_key,
    display_name,
    answer,
    correct,
    won
  ) values (
    v_session.id,
    v_tool.id,
    v_tool.venue_id,
    v_guest.id,
    v_round,
    v_guest.display_name,
    v_submitted,
    v_correct,
    false
  )
  returning id into v_id;

  if v_correct then
    begin
      update public.audience_guess_submissions
      set won = true
      where id = v_id;
    exception
      when unique_violation then
        update public.audience_guess_submissions
        set correct = false
        where id = v_id;
        return jsonb_build_object('ok', true, 'correct', true, 'won', false, 'late', true);
    end;
  end if;

  return jsonb_build_object(
    'ok', true,
    'correct', v_correct,
    'won', v_correct,
    'late', false
  );
end;
$$;

revoke all on function public.submit_audience_guess(text, text) from public, anon, authenticated;
grant execute on function public.submit_audience_guess(text, text) to service_role;

-- Audience hosts upload player photos and graphics under {venue}/audience/.
drop policy if exists screen_ads_objects_insert_audience on storage.objects;
create policy screen_ads_objects_insert_audience
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'screen-ads'
    and name ~ '^[0-9a-f-]{36}/audience/'
    and public.has_venue_role(
      (split_part(name, '/', 1))::uuid,
      array['admin', 'manager', 'interactor']::public.staff_role[]
    )
  );

drop policy if exists screen_ads_objects_update_audience on storage.objects;
create policy screen_ads_objects_update_audience
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'screen-ads'
    and name ~ '^[0-9a-f-]{36}/audience/'
    and public.has_venue_role(
      (split_part(name, '/', 1))::uuid,
      array['admin', 'manager', 'interactor']::public.staff_role[]
    )
  )
  with check (
    bucket_id = 'screen-ads'
    and name ~ '^[0-9a-f-]{36}/audience/'
    and public.has_venue_role(
      (split_part(name, '/', 1))::uuid,
      array['admin', 'manager', 'interactor']::public.staff_role[]
    )
  );

drop policy if exists screen_ads_objects_delete_audience on storage.objects;
create policy screen_ads_objects_delete_audience
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'screen-ads'
    and name ~ '^[0-9a-f-]{36}/audience/'
    and public.has_venue_role(
      (split_part(name, '/', 1))::uuid,
      array['admin', 'manager', 'interactor']::public.staff_role[]
    )
  );

notify pgrst, 'reload schema';
