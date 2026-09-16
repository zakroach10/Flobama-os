-- Cursors for push notification jobs (seen band IDs, last Monday reminder, etc.)

create table if not exists public.push_notification_cursors (
  venue_id uuid not null references public.venues (id) on delete cascade,
  kind text not null,
  last_run_at timestamptz,
  cursor_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (venue_id, kind),
  constraint push_notification_cursors_kind_len check (char_length(kind) between 1 and 64)
);

alter table public.push_notification_cursors enable row level security;

-- Service role / server jobs only; no authenticated client policies.
revoke all on table public.push_notification_cursors from anon, authenticated;
grant all on table public.push_notification_cursors to service_role;
