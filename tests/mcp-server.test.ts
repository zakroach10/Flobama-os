import { afterEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/mcp/route";
import { authorizeMcpRequest } from "@/lib/mcp/auth";
import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { MCP_TOOLS, runMcpTool } from "@/lib/mcp/tools";

const TOKEN = "test-mcp-token-value";

afterEach(() => {
  delete process.env.FLOBAMA_MCP_TOKEN;
});

describe("MCP auth", () => {
  it("rejects a missing token and a wrong bearer without accepting a short guess", () => {
    expect(authorizeMcpRequest(null, TOKEN)).toMatchObject({ ok: false, status: 401 });
    expect(authorizeMcpRequest("Bearer nope", TOKEN)).toMatchObject({ ok: false, status: 401 });
    expect(authorizeMcpRequest("Bearer ", TOKEN)).toMatchObject({ ok: false, status: 401 });
    expect(authorizeMcpRequest(`Bearer ${TOKEN}`, null)).toMatchObject({ ok: false, status: 503 });
    expect(authorizeMcpRequest(`Bearer ${TOKEN}`, TOKEN)).toMatchObject({ ok: true, touchLastUsed: false });
  });

  it("rejects the HTTP endpoint when the bearer is absent or wrong", async () => {
    process.env.FLOBAMA_MCP_TOKEN = TOKEN;
    const missing = await POST(new Request("https://admin.flobamadowntown.com/api/mcp", { method: "POST" }));
    expect(missing.status).toBe(401);
    const wrong = await POST(
      new Request("https://admin.flobamadowntown.com/api/mcp", {
        method: "POST",
        headers: { authorization: "Bearer not-the-token" },
      }),
    );
    expect(wrong.status).toBe(401);
    const unconfigured = await POST(new Request("https://admin.flobamadowntown.com/api/mcp", { method: "POST" }));
    delete process.env.FLOBAMA_MCP_TOKEN;
    const again = await POST(new Request("https://admin.flobamadowntown.com/api/mcp", { method: "POST" }));
    expect(unconfigured.status).toBe(401);
    expect(again.status).toBe(503);
  });
});

function queryResult(data: unknown) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  for (const method of ["select", "eq", "is", "order", "limit", "in", "gte", "neq", "insert", "update", "delete"]) {
    builder[method] = chain;
  }
  builder.maybeSingle = async () => ({ data, error: null });
  builder.single = async () => ({ data, error: null });
  builder.upsert = async () => {
    throw new Error("upsert should not run");
  };
  builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve({ data, error: null }).then(resolve, reject);
  return builder;
}

describe("MCP tools", () => {
  it("lists wall scenes for this venue only", async () => {
    const scene = {
      id: "22222222-2222-4222-8222-222222222222",
      title: "House logo",
      kind: "media",
      media_kind: "image",
      enabled: true,
      artist_id: null,
      venue_id: FLO_BAMA_VENUE_ID,
      sort_order: 1,
    };
    const client = {
      from(table: string) {
        if (table !== "led_wall_scenes") throw new Error(`unexpected ${table}`);
        return queryResult([scene]);
      },
    };
    const result = await runMcpTool("list_wall_scenes", {}, { client: client as never, venueId: FLO_BAMA_VENUE_ID });
    expect(result.ok).toBe(true);
    expect(result.scenes).toEqual([
      {
        id: scene.id,
        title: "House logo",
        kind: "media",
        mediaKind: "image",
        enabled: true,
        artistId: null,
      },
    ]);
  });

  it("previews a live wall change and does not write it", async () => {
    const scene = {
      id: "33333333-3333-4333-8333-333333333333",
      title: "Opener",
      enabled: true,
      kind: "media",
    };
    let upserts = 0;
    const client = {
      from(table: string) {
        const data =
          table === "led_wall_scenes"
            ? scene
            : table === "led_wall_runtime"
              ? { active_scene_id: null, active_playlist_id: null }
              : table === "mcp_audit_log"
                ? { id: "audit-1" }
                : null;
        const builder = queryResult(data);
        builder.upsert = async () => {
          upserts += 1;
          return { error: null };
        };
        return builder;
      },
    };
    const result = await runMcpTool(
      "put_scene_on_wall",
      { sceneId: scene.id },
      { client: client as never, venueId: FLO_BAMA_VENUE_ID },
    );
    expect(result.preview).toBe(true);
    expect(result.changed).toBe(false);
    expect(String(result.summary)).toContain("Opener");
    expect(upserts).toBe(0);
    expect(MCP_TOOLS.find((tool) => tool.name === "put_scene_on_wall")?.writes).toBe(true);
  });
});
