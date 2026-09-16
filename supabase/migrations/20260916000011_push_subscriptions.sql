-- Push notification subscriptions for FloBama OS PWA.
-- Each staff member can register one or more browser endpoints per venue.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_len check (char_length(endpoint) between 8 and 2048),
  constraint push_subscriptions_p256dh_len check (char_length(p256dh) between 8 and 512),
  constraint push_subscriptions_auth_len check (char_length(auth) between 8 and 512),
  unique (user_id, endpoint)
);

create index if not exists push_subscriptions_venue_user_idx
  on public.push_subscriptions (venue_id, user_id);

create index if not exists push_subscriptions_endpoint_idx
  on public.push_subscriptions (endpoint);

alter table public.push_subscriptions enable row level security;

create policy push_subscriptions_select_own
  on public.push_subscriptions
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and public.is_venue_member(venue_id)
  );

create policy push_subscriptions_insert_own
  on public.push_subscriptions
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_venue_member(venue_id)
  );

create policy push_subscriptions_update_own
  on public.push_subscriptions
  for update
  to authenticated
  using (
    user_id = auth.uid()
    and public.is_venue_member(venue_id)
  )
  with check (
    user_id = auth.uid()
    and public.is_venue_member(venue_id)
  );

create policy push_subscriptions_delete_own
  on public.push_subscriptions
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    and public.is_venue_member(venue_id)
  );
