-- Audit log for FloBama MCP write tools. Apply in the SQL editor before using write tools.
-- Not applied by this change. Service role inserts; venue members can read their own rows.

create table if not exists public.mcp_audit_log (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  tool_name text not null,
  actor text not null,
  preview_only boolean not null default false,
  input jsonb not null default '{}'::jsonb,
  ok boolean,
  message text,
  created_at timestamptz not null default now()
);

create index if not exists mcp_audit_log_venue_created_idx
  on public.mcp_audit_log (venue_id, created_at desc);

comment on table public.mcp_audit_log is
  'One row per FloBama MCP write-tool call. The bearer token is the actor; the token itself is never stored.';

alter table public.mcp_audit_log enable row level security;
alter table public.mcp_audit_log force row level security;

revoke all on public.mcp_audit_log from anon, public, authenticated;
grant select on public.mcp_audit_log to authenticated;

drop policy if exists mcp_audit_log_select_member on public.mcp_audit_log;
create policy mcp_audit_log_select_member
  on public.mcp_audit_log for select to authenticated
  using (public.is_venue_member(venue_id));
