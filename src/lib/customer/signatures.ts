import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyTimestampedSignature(input: {
  header: string | null;
  secret: string;
  rawBody: string;
  nowMs?: number;
  toleranceSec?: number;
}): boolean {
  if (!input.header || !input.secret) return false;
  const parts = new Map<string, string>();
  for (const piece of input.header.split(",")) {
    const [key, ...rest] = piece.split("=");
    if (!key || rest.length === 0) continue;
    parts.set(key.trim(), rest.join("=").trim());
  }
  const timestamp = parts.get("t");
  const signature = parts.get("v1");
  if (!timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
  const age = Math.abs((input.nowMs ?? Date.now()) / 1000 - Number(timestamp));
  if (age > (input.toleranceSec ?? 300)) return false;
  const expected = createHmac("sha256", input.secret).update(`${timestamp}.${input.rawBody}`).digest("hex");
  const actual = Buffer.from(signature);
  const digest = Buffer.from(expected);
  if (actual.length !== digest.length) return false;
  return timingSafeEqual(actual, digest);
}
