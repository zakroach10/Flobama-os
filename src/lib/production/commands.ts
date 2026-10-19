import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import {
  ecammEndpointByName,
  NON_IDEMPOTENT_ECAMM_ACTIONS,
  PRODUCTION_COMMAND_KINDS,
  type ProductionCommandKind,
} from "@/lib/production/ecamm-endpoints";
import type { ProductionCommandDelivery } from "@/lib/production/types";

type Admin = SupabaseClient<Database>;

export const PRODUCTION_COMMAND_TTL_MS = 2 * 60 * 1000;

const KIND_SET = new Set<string>(PRODUCTION_COMMAND_KINDS);

export function isProductionCommandKind(kind: string): kind is ProductionCommandKind {
  return KIND_SET.has(kind);
}

export function isProductionCommandExpired(expiresAt: string, now = new Date()) {
  return Date.parse(expiresAt) <= now.getTime();
}

export function validateEcammCallEndpoint(
  endpoint: string,
  params?: Record<string, unknown> | null,
  options?: { allowPerBusMute?: boolean },
): {
  ok: true;
  endpoint: string;
  nonIdempotent: boolean;
} | { ok: false; reason: string } {
  const name = endpoint.trim();
  if (!name) return { ok: false, reason: "Endpoint is required." };
  const def = ecammEndpointByName(name);
  if (!def) return { ok: false, reason: `Unknown or non-allowlisted Ecamm endpoint: ${name}` };
  if (def.status === "unsupported_gated") {
    return { ok: false, reason: `Endpoint ${name} is gated as unsupported.` };
  }
  // Per-bus mute is Companion-observed / undocumented — require explicit venue gate.
  if ((name === "setMute" || name === "getMute") && params?.bus != null && params.bus !== "") {
    if (!options?.allowPerBusMute) {
      return {
        ok: false,
        reason:
          "Per-bus mute is undocumented. Enable allow per-bus mute in Production → Devices after venue-Mac testing.",
      };
    }
  }
  return {
    ok: true,
    endpoint: name,
    nonIdempotent: NON_IDEMPOTENT_ECAMM_ACTIONS.has(name) || def.kind === "toggle",
  };
}

export async function enqueueProductionCommand(
  client: Admin,
  args: {
    venueId: string;
    deviceId: string;
    kind: ProductionCommandKind | string;
    endpoint?: string | null;
    payload?: Record<string, unknown>;
    issuedBy?: string | null;
    ttlMs?: number;
    dedupeKey?: string | null;
    status?: "pending" | "queued";
    allowPerBusMute?: boolean;
  },
) {
  if (!isProductionCommandKind(args.kind)) {
    return { command: null, error: `Unknown production command kind: ${args.kind}` };
  }

  let endpoint = args.endpoint ?? null;
  let payload = { ...(args.payload || {}) } as Record<string, unknown>;
  let nonIdempotent = false;

  if (args.kind === "ecamm_call" || args.kind === "ecamm_diagnostics_probe") {
    const target = String(endpoint || payload.endpoint || "").trim();
    const callParams =
      payload.params && typeof payload.params === "object"
        ? (payload.params as Record<string, unknown>)
        : payload;
    const checked = validateEcammCallEndpoint(target, callParams, {
      allowPerBusMute: Boolean(args.allowPerBusMute),
    });
    if (!checked.ok) return { command: null, error: checked.reason };
    endpoint = checked.endpoint;
    payload = { ...payload, endpoint: checked.endpoint, nonIdempotent: checked.nonIdempotent };
    nonIdempotent = checked.nonIdempotent;
  }

  const now = Date.now();
  const expiresAt = new Date(now + (args.ttlMs ?? PRODUCTION_COMMAND_TTL_MS)).toISOString();
  const { data, error } = await client
    .from("production_commands")
    .insert({
      venue_id: args.venueId,
      device_id: args.deviceId,
      kind: args.kind,
      endpoint,
      payload: { ...payload, nonIdempotent } as Json,
      status: args.status ?? "queued",
      issued_by: args.issuedBy ?? null,
      expires_at: expiresAt,
      dedupe_key: args.dedupeKey ?? null,
    })
    .select("id, kind, endpoint, payload, expires_at, status")
    .maybeSingle();

  if (error) return { command: null, error: error.message };
  return { command: data, error: null };
}

export async function listPendingProductionCommands(
  client: Admin,
  deviceId: string,
  now = new Date(),
) {
  const { data, error } = await client
    .from("production_commands")
    .select("id, kind, endpoint, payload, expires_at, status")
    .eq("device_id", deviceId)
    .in("status", ["pending", "queued"])
    .order("issued_at", { ascending: true })
    .limit(40);

  if (error) return { commands: [] as ProductionCommandDelivery[], error: error.message };

  const deliverable: ProductionCommandDelivery[] = [];
  const nowIso = now.toISOString();

  for (const command of data ?? []) {
    if (isProductionCommandExpired(command.expires_at, now)) {
      await client
        .from("production_commands")
        .update({
          status: "expired",
          completed_at: nowIso,
          reject_reason: "Command TTL expired before delivery.",
        })
        .eq("id", command.id);
      continue;
    }

    await client
      .from("production_commands")
      .update({ status: "sent", sent_at: nowIso })
      .eq("id", command.id)
      .in("status", ["pending", "queued"]);

    const payload = (command.payload || {}) as Record<string, unknown>;
    deliverable.push({
      id: command.id,
      kind: command.kind,
      payload: command.payload,
      expiresAt: command.expires_at,
      endpoint: command.endpoint,
      nonIdempotent: Boolean(payload.nonIdempotent),
    });
  }

  return { commands: deliverable, error: null };
}
