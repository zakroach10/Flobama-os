import type { SupabaseClient } from "@supabase/supabase-js";
import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { recordMcpAudit } from "@/lib/mcp/audit";
import { createMcpAccessKey, hashMcpKey, mcpKeyLast4 } from "@/lib/mcp/auth";

export const MCP_ACCESS_SQL = "supabase/migrations/20261109000068_mcp_access_keys.sql";

export type McpAccessRecord = {
  id: string;
  last4: string;
  createdAt: string;
  createdBy: string | null;
  lastUsedAt: string | null;
};

type Row = {
  id: string;
  key_hash: string;
  key_last4: string;
  created_by: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

function missingTable(message: string) {
  return /mcp_access_keys/i.test(message) && /does not exist|schema cache|could not find/i.test(message);
}

function sqlHint(message: string) {
  if (missingTable(message)) return `Apply ${MCP_ACCESS_SQL} in the Supabase SQL editor, then try again.`;
  return "Could not update the MCP key.";
}

export async function loadActiveMcpKey(client: SupabaseClient, venueId = FLO_BAMA_VENUE_ID) {
  const { data, error } = await client
    .from("mcp_access_keys" as never)
    .select("id, key_hash, key_last4, created_by, created_at, last_used_at, revoked_at")
    .eq("venue_id" as never, venueId as never)
    .is("revoked_at" as never, null)
    .maybeSingle();
  if (error) {
    if (missingTable(error.message)) return { key: null, missingTable: true, error: null as string | null };
    return { key: null, missingTable: false, error: error.message };
  }
  const row = data as Row | null;
  if (!row || row.revoked_at) return { key: null, missingTable: false, error: null as string | null };
  return {
    key: {
      id: row.id,
      hash: row.key_hash,
      last4: row.key_last4,
      createdAt: row.created_at,
      createdBy: row.created_by,
      lastUsedAt: row.last_used_at,
    },
    missingTable: false,
    error: null as string | null,
  };
}

export async function touchMcpKeyLastUsed(client: SupabaseClient, keyId: string, at = new Date()) {
  await client
    .from("mcp_access_keys" as never)
    .update({ last_used_at: at.toISOString() } as never)
    .eq("id" as never, keyId as never)
    .is("revoked_at" as never, null);
}

async function revokeActive(client: SupabaseClient, venueId: string, at: string) {
  const { error } = await client
    .from("mcp_access_keys" as never)
    .update({ revoked_at: at } as never)
    .eq("venue_id" as never, venueId as never)
    .is("revoked_at" as never, null);
  return error;
}

async function insertKey(
  client: SupabaseClient,
  input: { venueId: string; token: string; createdBy: string | null },
) {
  const { data, error } = await client
    .from("mcp_access_keys" as never)
    .insert({
      venue_id: input.venueId,
      key_hash: hashMcpKey(input.token),
      key_last4: mcpKeyLast4(input.token),
      created_by: input.createdBy,
    } as never)
    .select("id, key_last4, created_by, created_at, last_used_at")
    .single();
  if (error || !data) return { ok: false as const, message: sqlHint(error?.message ?? "Insert failed.") };
  const row = data as Row;
  return {
    ok: true as const,
    record: {
      id: row.id,
      last4: row.key_last4,
      createdAt: row.created_at,
      createdBy: row.created_by,
      lastUsedAt: row.last_used_at,
    } satisfies McpAccessRecord,
  };
}

async function auditKeyChange(
  client: SupabaseClient,
  input: { venueId: string; actor: string; action: "generate_mcp_key" | "rotate_mcp_key" | "revoke_mcp_key"; last4: string | null },
) {
  await recordMcpAudit(client, {
    venueId: input.venueId,
    toolName: input.action,
    actor: input.actor,
    previewOnly: false,
    input: { last4: input.last4 },
    ok: true,
    message: input.action.replaceAll("_", " "),
  });
}

export async function generateMcpAccessKey(
  client: SupabaseClient,
  input: { venueId: string; createdBy: string | null; actor: string; rotate: boolean },
) {
  const existing = await loadActiveMcpKey(client, input.venueId);
  if (existing.error) return { ok: false as const, message: sqlHint(existing.error) };
  if (existing.missingTable) return { ok: false as const, message: sqlHint("mcp_access_keys does not exist") };
  if (existing.key && !input.rotate) {
    return { ok: false as const, message: "A key is already active. Rotate it to replace the current one." };
  }
  if (!existing.key && input.rotate) {
    return { ok: false as const, message: "There is no key to rotate. Generate one first." };
  }

  const token = createMcpAccessKey();
  const now = new Date().toISOString();
  if (input.rotate) {
    const revokeError = await revokeActive(client, input.venueId, now);
    if (revokeError) return { ok: false as const, message: sqlHint(revokeError.message) };
  }
  const inserted = await insertKey(client, { venueId: input.venueId, token, createdBy: input.createdBy });
  if (!inserted.ok) return inserted;
  await auditKeyChange(client, {
    venueId: input.venueId,
    actor: input.actor,
    action: input.rotate ? "rotate_mcp_key" : "generate_mcp_key",
    last4: inserted.record.last4,
  });
  return { ok: true as const, token, record: inserted.record };
}

export async function revokeMcpAccessKey(client: SupabaseClient, input: { venueId: string; actor: string }) {
  const existing = await loadActiveMcpKey(client, input.venueId);
  if (existing.error) return { ok: false as const, message: sqlHint(existing.error) };
  if (existing.missingTable) return { ok: false as const, message: sqlHint("mcp_access_keys does not exist") };
  if (!existing.key) return { ok: false as const, message: "There is no active MCP key." };
  const revokeError = await revokeActive(client, input.venueId, new Date().toISOString());
  if (revokeError) return { ok: false as const, message: sqlHint(revokeError.message) };
  await auditKeyChange(client, {
    venueId: input.venueId,
    actor: input.actor,
    action: "revoke_mcp_key",
    last4: existing.key.last4,
  });
  return { ok: true as const, message: "MCP key revoked. Grok Bot cannot connect until you generate a new one." };
}
