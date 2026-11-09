import type { SupabaseClient } from "@supabase/supabase-js";

export const MCP_AUDIT_SQL = "supabase/migrations/20261109000067_mcp_audit_log.sql";

export type McpAuditWrite = {
  venueId: string;
  toolName: string;
  actor: string;
  previewOnly: boolean;
  input: Record<string, unknown>;
  ok: boolean | null;
  message: string | null;
};

function missingTable(message: string) {
  return /mcp_audit_log/i.test(message) && /does not exist|schema cache|could not find/i.test(message);
}

export async function recordMcpAudit(
  client: SupabaseClient,
  entry: McpAuditWrite,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const { data, error } = await client
    .from("mcp_audit_log" as never)
    .insert({
      venue_id: entry.venueId,
      tool_name: entry.toolName,
      actor: entry.actor.slice(0, 80),
      preview_only: entry.previewOnly,
      input: entry.input,
      ok: entry.ok,
      message: entry.message?.slice(0, 500) ?? null,
    } as never)
    .select("id")
    .single();
  if (error) {
    if (missingTable(error.message)) {
      return { ok: false, message: `Apply ${MCP_AUDIT_SQL} in the Supabase SQL editor, then try again.` };
    }
    return { ok: false, message: "Could not record the MCP audit log, so the change was not made." };
  }
  const id = (data as { id?: string } | null)?.id;
  if (!id) return { ok: false, message: "Could not record the MCP audit log, so the change was not made." };
  return { ok: true, id };
}
