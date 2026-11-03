import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const INTEGRATION_TOKEN_PREFIX = "fbint_";

export function createIntegrationToken() {
  return `${INTEGRATION_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function integrationTokenPrefix(token: string) {
  return token.slice(0, 12);
}

/** SHA-256 hex of the UTF-8 token. The plaintext token is never stored. */
export function hashIntegrationToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function integrationTokenMatches(storedHash: string, token: string) {
  const candidate = hashIntegrationToken(token);
  const stored = Buffer.from(storedHash);
  const next = Buffer.from(candidate);
  if (stored.length !== next.length) return false;
  return timingSafeEqual(stored, next);
}

export function hashIntegrationMaterial(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
