import { createHash } from "node:crypto";

export type IdempotencyRecord = {
  requestHash: string;
  status: "pending" | "completed";
};

export type IdempotencyDecision = "claim" | "replay" | "conflict" | "in_progress";

/**
 * Pure decision used by the in-memory store and mirrored by
 * integration_commit_event_create: claim, replay the original result,
 * reject a different payload, or ask the caller to retry an in-flight key.
 */
export function decideIdempotency(existing: IdempotencyRecord | null, requestHash: string): IdempotencyDecision {
  if (!existing) return "claim";
  if (existing.requestHash !== requestHash) return "conflict";
  if (existing.status === "completed") return "replay";
  return "in_progress";
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      if (record[key] !== undefined) sorted[key] = sortJson(record[key]);
    }
    return sorted;
  }
  return value;
}

export function hashCreatePayload(body: unknown) {
  return createHash("sha256")
    .update(
      canonicalJson({
        version: 1,
        method: "POST",
        path: "/api/integrations/v1/events",
        body,
      }),
      "utf8",
    )
    .digest("hex");
}
