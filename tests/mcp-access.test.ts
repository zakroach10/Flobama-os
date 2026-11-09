import { describe, expect, it } from "vitest";
import { authorizeMcpSettings } from "@/lib/auth/permissions";
import {
  MCP_KEY_PREFIX,
  MCP_LAST_USED_MIN_INTERVAL_MS,
  createMcpAccessKey,
  hashMcpKey,
  mcpKeyLast4,
  resolveMcpBearer,
} from "@/lib/mcp/auth";

describe("MCP access key", () => {
  it("creates a prefixed key of at least 32 random bytes and stores only a hash", () => {
    const key = createMcpAccessKey();
    expect(key.startsWith(MCP_KEY_PREFIX)).toBe(true);
    expect(key.length).toBeGreaterThan(MCP_KEY_PREFIX.length + 40);
    expect(hashMcpKey(key)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashMcpKey(key)).not.toContain(key);
    expect(mcpKeyLast4(key)).toHaveLength(4);
  });

  it("accepts the active key, rejects a revoked key, and rejects the previous key after rotation", () => {
    const current = createMcpAccessKey();
    const rotated = createMcpAccessKey();
    const active = { hash: hashMcpKey(current), lastUsedAt: null };

    expect(
      resolveMcpBearer({
        authorizationHeader: `Bearer ${current}`,
        envToken: null,
        activeKey: active,
        nowMs: 1_000_000,
      }),
    ).toMatchObject({ ok: true, touchLastUsed: true });

    expect(
      resolveMcpBearer({
        authorizationHeader: `Bearer ${current}`,
        envToken: null,
        activeKey: null,
      }).ok,
    ).toBe(false);
    expect(
      resolveMcpBearer({
        authorizationHeader: `Bearer ${current}`,
        envToken: null,
        activeKey: null,
      }).status,
    ).toBe(503);

    const next = { hash: hashMcpKey(rotated), lastUsedAt: new Date(1_000_000).toISOString() };
    expect(
      resolveMcpBearer({
        authorizationHeader: `Bearer ${current}`,
        envToken: null,
        activeKey: next,
        nowMs: 1_000_000 + MCP_LAST_USED_MIN_INTERVAL_MS,
      }),
    ).toMatchObject({ ok: false, status: 401 });
    expect(
      resolveMcpBearer({
        authorizationHeader: `Bearer ${rotated}`,
        envToken: null,
        activeKey: next,
        nowMs: 1_000_000 + 10_000,
      }),
    ).toMatchObject({ ok: true, touchLastUsed: false });
  });

  it("returns 503 when neither the settings key nor the env fallback is configured", () => {
    expect(
      resolveMcpBearer({ authorizationHeader: null, envToken: null, activeKey: null }),
    ).toMatchObject({ ok: false, status: 503 });
    expect(
      resolveMcpBearer({
        authorizationHeader: "Bearer fbmcp_anything",
        envToken: "   ",
        activeKey: null,
      }),
    ).toMatchObject({ ok: false, status: 503 });
  });

  it("still accepts the env fallback and does not mark that as a database use", () => {
    expect(
      resolveMcpBearer({
        authorizationHeader: "Bearer env-token-value",
        envToken: "env-token-value",
        activeKey: null,
      }),
    ).toMatchObject({ ok: true, touchLastUsed: false });
  });
});

describe("MCP settings role", () => {
  it("allows admins and refuses every other staff role", () => {
    expect(authorizeMcpSettings("admin")).toEqual({ allowed: true });
    for (const role of ["manager", "viewer", "server", "interactor"] as const) {
      const decision = authorizeMcpSettings(role);
      expect(decision.allowed).toBe(false);
      if (!decision.allowed) expect(decision.reason).toMatch(/admin/i);
    }
    expect(authorizeMcpSettings(null).allowed).toBe(false);
  });
});
