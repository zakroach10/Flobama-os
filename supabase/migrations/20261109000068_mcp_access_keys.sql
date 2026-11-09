-- One active Grok Bot MCP key per venue. Stores a SHA-256 hash only.
-- Apply in the SQL editor. Not applied by this change.
-- anon and authenticated have no privileges. The service role reads and writes it.

create table if not exists public.mcp_access_keys (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  key_hash text not null,
  key_last4 text not null check (char_length(key_last4) = 4),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create unique index if not exists mcp_access_keys_one_active_idx
  on public.mcp_access_keys (venue_id)
  where revoked_at is null;

comment on table public.mcp_access_keys is
  'SHA-256 hash of the FloBama MCP bearer key. The plaintext key is shown once in Settings and is never stored.';

alter table public.mcp_access_keys enable row level security;
alter table public.mcp_access_keys force row level security;

revoke all on public.mcp_access_keys from anon, public, authenticated;
