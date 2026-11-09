import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpDeps } from "@/lib/mcp/tools";
import { MCP_TOOLS } from "@/lib/mcp/tools";

export function createFlobamaMcpServer(deps: McpDeps) {
  const server = new McpServer({ name: "flobama-os", version: "1.0.0" });
  const register = server.registerTool.bind(server) as (
    name: string,
    config: {
      description?: string;
      inputSchema?: object;
      annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean };
    },
    cb: (args: Record<string, unknown>) => Promise<{
      isError?: boolean;
      content: Array<{ type: "text"; text: string }>;
    }>,
  ) => void;
  for (const tool of MCP_TOOLS) {
    const destructive = "destructive" in tool && tool.destructive === true;
    register(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: {
          readOnlyHint: !tool.writes,
          destructiveHint: destructive,
          idempotentHint: !destructive,
        },
      },
      async (args) => {
        const result = await tool.run(args as never, deps);
        return {
          isError: result.ok === false,
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      },
    );
  }
  return server;
}
