import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const FLOBAMA_MCP_TOKEN_ENV = "FLOBAMA_MCP_TOKEN";
export const MCP_KEY_PREFIX = "fbmcp_";
/** Skip last_used_at writes that are more frequent than this. */
export const MCP_LAST_USED_MIN_INTERVAL_MS = 60_000;

export type McpAuthResult =
  | { ok: true; touchLastUsed: boolean }
  | { ok: false; status: 401 | 503; message: string; touchLastUsed: false };

export type ActiveMcpKey = {
  hash: string;
  lastUsedAt: string | null;
};

function bearerToken(authorizationHeader: string | null) {
  const header = authorizationHeader?.trim() ?? "";
  return /^Bearer\s+(\S+)\s*$/i.exec(header)?.[1] ?? "";
}

function secretsEqual(provided: string, expected: string) {
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length) {
    timingSafeEqual(expectedBuf, expectedBuf);
    return false;
  }
  return timingSafeEqual(providedBuf, expectedBuf);
}

/** 32 random bytes, URL-safe, prefixed so it is obvious in a header. */
export function createMcpAccessKey() {
  return `${MCP_KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function hashMcpKey(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function mcpKeyLast4(token: string) {
  return token.slice(-4);
}

export function mcpKeyMatches(token: string, storedHash: string) {
  return secretsEqual(hashMcpKey(token), storedHash.trim().toLowerCase());
}

/** Constant-time bearer check against the optional env fallback. */
export function authorizeMcpRequest(authorizationHeader: string | null, expectedToken: string | null): McpAuthResult {
  const decision = resolveMcpBearer({
    authorizationHeader,
    envToken: expectedToken,
    activeKey: null,
  });
  return decision;
}

/**
 * Accept the settings key or, if that does not match, the optional FLOBAMA_MCP_TOKEN.
 * 503 only when neither source is configured.
 */
export function resolveMcpBearer(input: {
  authorizationHeader: string | null;
  envToken: string | null | undefined;
  activeKey: ActiveMcpKey | null;
  nowMs?: number;
}): McpAuthResult {
  const env = input.envToken?.trim() ?? "";
  const configured = Boolean(env) || Boolean(input.activeKey);
  if (!configured) {
    return { ok: false, status: 503, message: "MCP is not configured.", touchLastUsed: false };
  }

  const provided = bearerToken(input.authorizationHeader);
  if (!provided) {
    return { ok: false, status: 401, message: "Unauthorized", touchLastUsed: false };
  }

  if (input.activeKey && mcpKeyMatches(provided, input.activeKey.hash)) {
    const now = input.nowMs ?? Date.now();
    const last = input.activeKey.lastUsedAt ? Date.parse(input.activeKey.lastUsedAt) : Number.NaN;
    const touchLastUsed = !Number.isFinite(last) || now - last >= MCP_LAST_USED_MIN_INTERVAL_MS;
    return { ok: true, touchLastUsed };
  }

  if (env && secretsEqual(provided, env)) {
    return { ok: true, touchLastUsed: false };
  }

  return { ok: false, status: 401, message: "Unauthorized", touchLastUsed: false };
}
