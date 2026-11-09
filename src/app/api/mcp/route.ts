import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { loadActiveMcpKey, touchMcpKeyLastUsed } from "@/lib/mcp/access-store";
import { resolveMcpBearer } from "@/lib/mcp/auth";
import { createFlobamaMcpServer } from "@/lib/mcp/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function denied(status: number, message: string) {
  return Response.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
}

async function handle(request: Request) {
  const envToken = process.env.FLOBAMA_MCP_TOKEN ?? null;
  const client = createServiceRoleClient();
  let activeKey: { hash: string; lastUsedAt: string | null } | null = null;
  let activeKeyId: string | null = null;
  if (client) {
    try {
      const loaded = await loadActiveMcpKey(client, FLO_BAMA_VENUE_ID);
      if (loaded.key) {
        activeKey = { hash: loaded.key.hash, lastUsedAt: loaded.key.lastUsedAt };
        activeKeyId = loaded.key.id;
      }
    } catch {
      activeKey = null;
    }
  }

  const auth = resolveMcpBearer({
    authorizationHeader: request.headers.get("authorization"),
    envToken,
    activeKey,
  });
  if (!auth.ok) return denied(auth.status, auth.message);
  if (!client) return denied(503, "Supabase is not configured.");
  if (auth.touchLastUsed && activeKeyId) {
    await touchMcpKeyLastUsed(client, activeKeyId);
  }

  const server = createFlobamaMcpServer({ client });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export function GET(request: Request) {
  return handle(request);
}

export function POST(request: Request) {
  return handle(request);
}

export function DELETE(request: Request) {
  return handle(request);
}
