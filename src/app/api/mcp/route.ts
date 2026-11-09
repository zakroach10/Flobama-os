import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authorizeMcpRequest } from "@/lib/mcp/auth";
import { createFlobamaMcpServer } from "@/lib/mcp/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function denied(status: number, message: string) {
  return Response.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
}

async function handle(request: Request) {
  const auth = authorizeMcpRequest(request.headers.get("authorization"), process.env.FLOBAMA_MCP_TOKEN ?? null);
  if (!auth.ok) return denied(auth.status, auth.message);

  const client = createServiceRoleClient();
  if (!client) return denied(503, "Supabase is not configured.");

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
