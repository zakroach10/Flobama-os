import { timingSafeEqual } from "node:crypto";

export const FLOBAMA_MCP_TOKEN_ENV = "FLOBAMA_MCP_TOKEN";

export type McpAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; message: string };

/** Constant-time bearer check. A missing server token is not configured, not a bad password. */
export function authorizeMcpRequest(authorizationHeader: string | null, expectedToken: string | null): McpAuthResult {
  const expected = expectedToken?.trim() ?? "";
  if (!expected) {
    return { ok: false, status: 503, message: "MCP is not configured." };
  }

  const header = authorizationHeader?.trim() ?? "";
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  const provided = match?.[1] ?? "";
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length) {
    timingSafeEqual(expectedBuf, expectedBuf);
    return { ok: false, status: 401, message: "Unauthorized" };
  }
  if (!timingSafeEqual(providedBuf, expectedBuf)) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }
  return { ok: true };
}
