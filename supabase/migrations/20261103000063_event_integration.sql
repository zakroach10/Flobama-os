-- Server-to-server event integration for the legacy HighLevel event manager.
-- This migration does not insert, update, or republish existing events.
-- Anonymous and staff JWTs cannot read credential hashes or call the write functions.
-- The service role bypasses RLS; every function re-checks the credential, venue, and scope.

create table if not exists public.integration_credentials (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  token_hash text not null check (char_length(token_hash) = 64),
  token_prefix text not null check (char_length(token_prefix) between 8 and 24),
  scopes text[] not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_credentials_scopes_allowed check (
    cardinality(scopes) >= 1
    and scopes <@ array['events:read', 'events:write', 'artists:read', 'artwork:write']::text[]
  )
);

create unique index if not exists integration_credentials_token_hash_uidx
  on public.integration_credentials (token_hash);

create index if not exists integration_credentials_venue_idx
  on public.integration_credentials (venue_id, created_at desc);

drop trigger if exists integration_credentials_set_updated_at on public.integration_credentials;
create trigger integration_credentials_set_updated_at
  before update on public.integration_credentials
  for each row execute function public.set_updated_at();

create table if not exists public.integration_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  credential_id uuid not null references public.integration_credentials (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  request_hash text not null check (char_length(request_hash) = 64),
  status text not null check (status in ('pending', 'completed')),
  response_status integer,
  response_parts jsonb,
  event_id uuid references public.events (id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (credential_id, idempotency_key)
);

create index if not exists integration_idempotency_event_idx
  on public.integration_idempotency_keys (event_id);

create table if not exists public.integration_audit_log (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references public.venues (id) on delete cascade,
  credential_id uuid references public.integration_credentials (id) on delete set null,
  action text not null check (char_length(action) between 1 and 80),
  event_id uuid,
  request_id text not null check (char_length(request_id) between 8 and 80),
  reported_actor text check (reported_actor is null or char_length(reported_actor) <= 120),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists integration_audit_log_venue_idx
  on public.integration_audit_log (venue_id, created_at desc);

create index if not exists integration_audit_log_event_idx
  on public.integration_audit_log (event_id, created_at desc);

create table if not exists public.integration_rate_buckets (
  bucket_key text not null check (char_length(bucket_key) between 1 and 200),
  window_start timestamptz not null,
  request_count integer not null check (request_count >= 0),
  primary key (bucket_key, window_start)
);

alter table public.integration_credentials enable row level security;
alter table public.integration_credentials force row level security;
alter table public.integration_idempotency_keys enable row level security;
alter table public.integration_idempotency_keys force row level security;
alter table public.integration_audit_log enable row level security;
alter table public.integration_audit_log force row level security;
alter table public.integration_rate_buckets enable row level security;
alter table public.integration_rate_buckets force row level security;

revoke all on public.integration_credentials from anon, public, authenticated;
revoke all on public.integration_idempotency_keys from anon, public, authenticated;
revoke all on public.integration_audit_log from anon, public, authenticated;
revoke all on public.integration_rate_buckets from anon, public, authenticated;

grant select on public.integration_audit_log to authenticated;

drop policy if exists integration_audit_select_admin on public.integration_audit_log;
create policy integration_audit_select_admin
  on public.integration_audit_log
  for select
  to authenticated
  using (venue_id is not null and public.has_venue_role(venue_id, array['admin']::public.staff_role[]));

-- Canonical event snapshot shared by create, update, and replay.
-- Keep these keys aligned with EventParts in src/lib/integrations/contract.ts.
create or replace function public.integration_event_parts(p_event_id uuid, p_venue_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', e.id,
    'venue_id', e.venue_id,
    'title', e.title,
    'public_description', e.public_description,
    'internal_notes', e.internal_notes,
    'event_type', e.event_type,
    'starts_at', e.starts_at,
    'ends_at', e.ends_at,
    'location_label', e.location_label,
    'status', e.status,
    'visibility', e.visibility,
    'featured', e.featured,
    'archived_at', e.archived_at,
    'is_ticketed', e.is_ticketed,
    'ticket_url', e.ticket_url,
    'cover_label', e.cover_label,
    'created_at', e.created_at,
    'updated_at', e.updated_at,
    'artists', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'name', a.name,
          'display_order', ea.display_order,
          'artwork', case
            when s.id is null then null
            else jsonb_build_object(
              'media_kind', s.media_kind,
              'public_url', s.public_url,
              'enabled', s.enabled
            )
          end
        )
        order by ea.display_order, a.id
      )
      from public.event_artists ea
      join public.artists a on a.id = ea.artist_id and a.venue_id = ea.venue_id
      left join public.led_wall_scenes s
        on s.artist_id = a.id
       and s.venue_id = ea.venue_id
      where ea.event_id = e.id
        and ea.venue_id = e.venue_id
    ), '[]'::jsonb)
  )
  from public.events e
  where e.id = p_event_id
    and e.venue_id = p_venue_id;
$$;

create or replace function public.integration_credential_allows(
  p_credential_id uuid,
  p_venue_id uuid,
  p_scope text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.integration_credentials c
    where c.id = p_credential_id
      and c.venue_id = p_venue_id
      and c.revoked_at is null
      and p_scope = any (c.scopes)
  );
$$;

create or replace function public.integration_consume_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz;
  v_count integer;
  v_retry integer;
begin
  if p_bucket_key is null or char_length(p_bucket_key) < 1 or p_limit < 1 or p_window_seconds < 1 then
    return jsonb_build_object('allowed', false, 'remaining', 0, 'retryAfterSeconds', 60, 'limit', greatest(p_limit, 0));
  end if;

  v_window := to_timestamp(floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds);

  insert into public.integration_rate_buckets (bucket_key, window_start, request_count)
  values (p_bucket_key, v_window, 1)
  on conflict (bucket_key, window_start)
  do update set request_count = public.integration_rate_buckets.request_count + 1
  returning request_count into v_count;

  delete from public.integration_rate_buckets
  where bucket_key = p_bucket_key
    and window_start < v_window - interval '2 days';

  if v_count > p_limit then
    v_retry := ceil(extract(epoch from (v_window + make_interval(secs => p_window_seconds) - clock_timestamp())));
    if v_retry < 1 then
      v_retry := 1;
    end if;
    return jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'retryAfterSeconds', v_retry,
      'limit', p_limit
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'remaining', p_limit - v_count,
    'retryAfterSeconds', 0,
    'limit', p_limit
  );
end;
$$;

create or replace function public.integration_artists_in_venue(
  p_venue_id uuid,
  p_artist_ids uuid[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(cardinality(p_artist_ids), 0) = 0
    or (
      select count(distinct a.id)
      from public.artists a
      where a.venue_id = p_venue_id
        and a.id = any (p_artist_ids)
    ) = (
      select count(distinct artist_id)
      from unnest(p_artist_ids) as artist_id
    );
$$;

-- Atomic create: the idempotency row and the event commit together.
-- Same key + same request hash replays the original snapshot.
-- Same key + different hash returns idempotency_conflict and writes nothing.
create or replace function public.integration_commit_event_create(
  p_credential_id uuid,
  p_venue_id uuid,
  p_idempotency_key text,
  p_request_hash text,
  p_fields jsonb,
  p_artist_ids uuid[],
  p_request_id text,
  p_reported_actor text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed_id uuid;
  v_existing public.integration_idempotency_keys%rowtype;
  v_event public.events%rowtype;
  v_parts jsonb;
  v_index integer;
begin
  if not public.integration_credential_allows(p_credential_id, p_venue_id, 'events:write') then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 or char_length(p_request_hash) <> 64 then
    return jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;

  if not public.integration_artists_in_venue(p_venue_id, p_artist_ids) then
    return jsonb_build_object('ok', false, 'code', 'invalid_artists');
  end if;

  begin
    insert into public.integration_idempotency_keys (
      credential_id,
      venue_id,
      idempotency_key,
      request_hash,
      status
    ) values (
      p_credential_id,
      p_venue_id,
      p_idempotency_key,
      p_request_hash,
      'pending'
    )
    on conflict (credential_id, idempotency_key) do nothing
    returning id into v_claimed_id;

    if v_claimed_id is null then
      select * into v_existing
      from public.integration_idempotency_keys
      where credential_id = p_credential_id
        and idempotency_key = p_idempotency_key
      for update;

      if v_existing.request_hash is distinct from p_request_hash then
        return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
      end if;

      if v_existing.status = 'completed' and v_existing.response_parts is not null then
        insert into public.integration_audit_log (
          venue_id, credential_id, action, event_id, request_id, reported_actor, metadata
        ) values (
          p_venue_id,
          p_credential_id,
          'events.create',
          v_existing.event_id,
          p_request_id,
          p_reported_actor,
          jsonb_build_object('replay', true)
        );
        return jsonb_build_object(
          'ok', true,
          'replay', true,
          'parts', v_existing.response_parts
        );
      end if;

      return jsonb_build_object('ok', false, 'code', 'idempotency_in_progress');
    end if;

    insert into public.events (
      venue_id,
      title,
      public_description,
      internal_notes,
      event_type,
      starts_at,
      ends_at,
      location_label,
      status,
      visibility,
      featured,
      is_ticketed,
      ticket_url,
      cover_label
    ) values (
      p_venue_id,
      p_fields->>'title',
      p_fields->>'public_description',
      p_fields->>'internal_notes',
      (p_fields->>'event_type')::public.event_type,
      (p_fields->>'starts_at')::timestamptz,
      (p_fields->>'ends_at')::timestamptz,
      p_fields->>'location_label',
      (p_fields->>'status')::public.event_status,
      (p_fields->>'visibility')::public.event_visibility,
      coalesce((p_fields->>'featured')::boolean, false),
      coalesce((p_fields->>'is_ticketed')::boolean, false),
      p_fields->>'ticket_url',
      p_fields->>'cover_label'
    )
    returning * into v_event;

    if p_artist_ids is not null then
      for v_index in 1 .. coalesce(cardinality(p_artist_ids), 0) loop
        insert into public.event_artists (venue_id, event_id, artist_id, display_order)
        values (p_venue_id, v_event.id, p_artist_ids[v_index], v_index - 1);
      end loop;
    end if;

    v_parts := public.integration_event_parts(v_event.id, p_venue_id);
    if v_parts is null then
      raise exception 'integration event snapshot missing';
    end if;

    update public.integration_idempotency_keys
    set status = 'completed',
        response_status = 201,
        response_parts = v_parts,
        event_id = v_event.id,
        completed_at = clock_timestamp()
    where id = v_claimed_id;

    insert into public.integration_audit_log (
      venue_id, credential_id, action, event_id, request_id, reported_actor, metadata
    ) values (
      p_venue_id,
      p_credential_id,
      'events.create',
      v_event.id,
      p_request_id,
      p_reported_actor,
      jsonb_build_object('replay', false, 'status', v_event.status, 'visibility', v_event.visibility)
    );

    return jsonb_build_object('ok', true, 'replay', false, 'parts', v_parts);
  exception
    when others then
      return jsonb_build_object('ok', false, 'code', 'server_error');
  end;
end;
$$;

create or replace function public.integration_commit_event_update(
  p_credential_id uuid,
  p_venue_id uuid,
  p_event_id uuid,
  p_expected_updated_at timestamptz,
  p_patch jsonb,
  p_artist_ids uuid[],
  p_replace_artists boolean,
  p_request_id text,
  p_reported_actor text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_title text;
  v_public_description text;
  v_internal_notes text;
  v_event_type public.event_type;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_location_label text;
  v_status public.event_status;
  v_visibility public.event_visibility;
  v_featured boolean;
  v_is_ticketed boolean;
  v_ticket_url text;
  v_cover_label text;
  v_archived_at timestamptz;
  v_updated public.events%rowtype;
  v_parts jsonb;
  v_index integer;
begin
  if not public.integration_credential_allows(p_credential_id, p_venue_id, 'events:write') then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  if p_replace_artists and not public.integration_artists_in_venue(p_venue_id, p_artist_ids) then
    return jsonb_build_object('ok', false, 'code', 'invalid_artists');
  end if;

  select * into v_event
  from public.events
  where id = p_event_id
    and venue_id = p_venue_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_event.updated_at is distinct from p_expected_updated_at then
    insert into public.integration_audit_log (
      venue_id, credential_id, action, event_id, request_id, reported_actor, metadata
    ) values (
      p_venue_id,
      p_credential_id,
      'events.update',
      p_event_id,
      p_request_id,
      p_reported_actor,
      jsonb_build_object('result', 'edit_conflict')
    );
    return jsonb_build_object(
      'ok', false,
      'code', 'edit_conflict',
      'currentUpdatedAt', v_event.updated_at
    );
  end if;

  v_title := v_event.title;
  v_public_description := v_event.public_description;
  v_internal_notes := v_event.internal_notes;
  v_event_type := v_event.event_type;
  v_starts_at := v_event.starts_at;
  v_ends_at := v_event.ends_at;
  v_location_label := v_event.location_label;
  v_status := v_event.status;
  v_visibility := v_event.visibility;
  v_featured := v_event.featured;
  v_is_ticketed := v_event.is_ticketed;
  v_ticket_url := v_event.ticket_url;
  v_cover_label := v_event.cover_label;
  v_archived_at := v_event.archived_at;

  if jsonb_exists(p_patch, 'title') then
    v_title := p_patch->>'title';
  end if;
  if jsonb_exists(p_patch, 'public_description') then
    v_public_description := p_patch->>'public_description';
  end if;
  if jsonb_exists(p_patch, 'internal_notes') then
    v_internal_notes := p_patch->>'internal_notes';
  end if;
  if jsonb_exists(p_patch, 'event_type') then
    v_event_type := (p_patch->>'event_type')::public.event_type;
  end if;
  if jsonb_exists(p_patch, 'starts_at') then
    v_starts_at := (p_patch->>'starts_at')::timestamptz;
  end if;
  if jsonb_exists(p_patch, 'ends_at') then
    v_ends_at := (p_patch->>'ends_at')::timestamptz;
  end if;
  if jsonb_exists(p_patch, 'location_label') then
    v_location_label := p_patch->>'location_label';
  end if;
  if jsonb_exists(p_patch, 'status') then
    v_status := (p_patch->>'status')::public.event_status;
  end if;
  if jsonb_exists(p_patch, 'visibility') then
    v_visibility := (p_patch->>'visibility')::public.event_visibility;
  end if;
  if jsonb_exists(p_patch, 'featured') then
    v_featured := (p_patch->>'featured')::boolean;
  end if;
  if jsonb_exists(p_patch, 'is_ticketed') then
    v_is_ticketed := (p_patch->>'is_ticketed')::boolean;
  end if;
  if jsonb_exists(p_patch, 'ticket_url') then
    v_ticket_url := p_patch->>'ticket_url';
  end if;
  if jsonb_exists(p_patch, 'cover_label') then
    v_cover_label := p_patch->>'cover_label';
  end if;
  if jsonb_exists(p_patch, 'archived') then
    if (p_patch->>'archived')::boolean then
      v_archived_at := coalesce(v_archived_at, clock_timestamp());
    else
      v_archived_at := null;
    end if;
  end if;

  update public.events
  set title = v_title,
      public_description = v_public_description,
      internal_notes = v_internal_notes,
      event_type = v_event_type,
      starts_at = v_starts_at,
      ends_at = v_ends_at,
      location_label = v_location_label,
      status = v_status,
      visibility = v_visibility,
      featured = v_featured,
      is_ticketed = v_is_ticketed,
      ticket_url = v_ticket_url,
      cover_label = v_cover_label,
      archived_at = v_archived_at
  where id = p_event_id
    and venue_id = p_venue_id
    and updated_at = p_expected_updated_at
  returning * into v_updated;

  if v_updated.id is null then
    return jsonb_build_object('ok', false, 'code', 'edit_conflict', 'currentUpdatedAt', v_event.updated_at);
  end if;

  if p_replace_artists then
    delete from public.event_artists
    where event_id = p_event_id
      and venue_id = p_venue_id;

    if p_artist_ids is not null then
      for v_index in 1 .. coalesce(cardinality(p_artist_ids), 0) loop
        insert into public.event_artists (venue_id, event_id, artist_id, display_order)
        values (p_venue_id, p_event_id, p_artist_ids[v_index], v_index - 1);
      end loop;
    end if;
  end if;

  v_parts := public.integration_event_parts(p_event_id, p_venue_id);

  insert into public.integration_audit_log (
    venue_id, credential_id, action, event_id, request_id, reported_actor, metadata
  ) values (
    p_venue_id,
    p_credential_id,
    'events.update',
    p_event_id,
    p_request_id,
    p_reported_actor,
    jsonb_build_object('result', 'updated', 'status', v_updated.status, 'visibility', v_updated.visibility)
  );

  return jsonb_build_object('ok', true, 'parts', v_parts);
exception
  when others then
    return jsonb_build_object('ok', false, 'code', 'server_error');
end;
$$;

create or replace function public.integration_get_event(
  p_credential_id uuid,
  p_venue_id uuid,
  p_event_id uuid,
  p_request_id text,
  p_reported_actor text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parts jsonb;
begin
  if not public.integration_credential_allows(p_credential_id, p_venue_id, 'events:read')
     and not public.integration_credential_allows(p_credential_id, p_venue_id, 'events:write') then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  v_parts := public.integration_event_parts(p_event_id, p_venue_id);
  if v_parts is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  insert into public.integration_audit_log (
    venue_id, credential_id, action, event_id, request_id, reported_actor, metadata
  ) values (
    p_venue_id, p_credential_id, 'events.read', p_event_id, p_request_id, p_reported_actor, '{}'::jsonb
  );

  return jsonb_build_object('ok', true, 'parts', v_parts);
end;
$$;

create or replace function public.integration_list_events(
  p_credential_id uuid,
  p_venue_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_statuses text[],
  p_visibility text,
  p_include_archived boolean,
  p_limit integer,
  p_cursor_starts_at timestamptz,
  p_cursor_id uuid,
  p_request_id text,
  p_reported_actor text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_events jsonb;
begin
  if not public.integration_credential_allows(p_credential_id, p_venue_id, 'events:read') then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 101 then
    return jsonb_build_object('ok', false, 'code', 'invalid_input');
  end if;

  select coalesce(jsonb_agg(item.parts order by item.starts_at, item.id), '[]'::jsonb)
  into v_events
  from (
    select e.id, e.starts_at, public.integration_event_parts(e.id, e.venue_id) as parts
    from public.events e
    where e.venue_id = p_venue_id
      and (p_include_archived or e.archived_at is null)
      and (p_statuses is null or cardinality(p_statuses) = 0 or e.status::text = any (p_statuses))
      and (p_visibility is null or e.visibility::text = p_visibility)
      and (p_from is null or e.starts_at >= p_from)
      and (p_to is null or e.starts_at <= p_to)
      and (
        p_cursor_starts_at is null
        or e.starts_at > p_cursor_starts_at
        or (e.starts_at = p_cursor_starts_at and (p_cursor_id is null or e.id > p_cursor_id))
      )
    order by e.starts_at, e.id
    limit p_limit
  ) item;

  insert into public.integration_audit_log (
    venue_id, credential_id, action, event_id, request_id, reported_actor, metadata
  ) values (
    p_venue_id,
    p_credential_id,
    'events.list',
    null,
    p_request_id,
    p_reported_actor,
    jsonb_build_object('returned', jsonb_array_length(v_events))
  );

  return jsonb_build_object('ok', true, 'events', v_events);
end;
$$;

revoke all on function public.integration_event_parts(uuid, uuid) from public, anon, authenticated;
revoke all on function public.integration_credential_allows(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.integration_consume_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.integration_artists_in_venue(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.integration_commit_event_create(uuid, uuid, text, text, jsonb, uuid[], text, text) from public, anon, authenticated;
revoke all on function public.integration_commit_event_update(uuid, uuid, uuid, timestamptz, jsonb, uuid[], boolean, text, text) from public, anon, authenticated;
revoke all on function public.integration_get_event(uuid, uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.integration_list_events(uuid, uuid, timestamptz, timestamptz, text[], text, boolean, integer, timestamptz, uuid, text, text) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.integration_event_parts(uuid, uuid) to service_role;
    grant execute on function public.integration_credential_allows(uuid, uuid, text) to service_role;
    grant execute on function public.integration_consume_rate_limit(text, integer, integer) to service_role;
    grant execute on function public.integration_artists_in_venue(uuid, uuid[]) to service_role;
    grant execute on function public.integration_commit_event_create(uuid, uuid, text, text, jsonb, uuid[], text, text) to service_role;
    grant execute on function public.integration_commit_event_update(uuid, uuid, uuid, timestamptz, jsonb, uuid[], boolean, text, text) to service_role;
    grant execute on function public.integration_get_event(uuid, uuid, uuid, text, text) to service_role;
    grant execute on function public.integration_list_events(uuid, uuid, timestamptz, timestamptz, text[], text, boolean, integer, timestamptz, uuid, text, text) to service_role;
  end if;
end
$$;

notify pgrst, 'reload schema';
