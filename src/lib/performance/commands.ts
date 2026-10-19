import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";

type Admin = SupabaseClient<Database>;

export const PERFORMANCE_COMMAND_TTL_MS = 2 * 60 * 1000;

export type PerformanceCommandKind =
  | "scan_recordings"
  | "set_recordings_root"
  | "prepare_recording"
  | "play_now"
  | "play_next"
  | "queue_add"
  | "queue_remove"
  | "queue_reorder"
  | "pause"
  | "resume"
  | "seek"
  | "skip"
  | "set_audio_muted"
  | "stop_return_normal";

export function isPerformanceCommandExpired(expiresAt: string, now = new Date()) {
  return Date.parse(expiresAt) <= now.getTime();
}

export async function enqueuePerformanceCommand(
  client: Admin,
  args: {
    venueId: string;
    deviceId: string;
    kind: PerformanceCommandKind;
    payload?: Record<string, unknown>;
    issuedBy?: string | null;
    ttlMs?: number;
  },
) {
  const now = Date.now();
  const expiresAt = new Date(now + (args.ttlMs ?? PERFORMANCE_COMMAND_TTL_MS)).toISOString();
  const { data, error } = await client
    .from("performance_commands")
    .insert({
      venue_id: args.venueId,
      device_id: args.deviceId,
      kind: args.kind,
      payload: (args.payload || {}) as Json,
      status: "pending",
      issued_by: args.issuedBy ?? null,
      expires_at: expiresAt,
    })
    .select("id, kind, payload, expires_at, status")
    .maybeSingle();

  if (error) return { command: null, error: error.message };
  return { command: data, error: null };
}

export async function listPendingPerformanceCommands(
  client: Admin,
  deviceId: string,
  now = new Date(),
) {
  const { data, error } = await client
    .from("performance_commands")
    .select("id, kind, payload, expires_at, status")
    .eq("device_id", deviceId)
    .eq("status", "pending")
    .order("issued_at", { ascending: true })
    .limit(40);

  if (error) return { commands: [], error: error.message };

  const deliverable: Array<{
    id: string;
    kind: string;
    payload: Json;
    expiresAt: string;
  }> = [];

  for (const command of data ?? []) {
    if (isPerformanceCommandExpired(command.expires_at, now)) {
      await client
        .from("performance_commands")
        .update({
          status: "expired",
          completed_at: now.toISOString(),
          reject_reason: "Command TTL expired before delivery.",
        })
        .eq("id", command.id);
      continue;
    }
    deliverable.push({
      id: command.id,
      kind: command.kind,
      payload: command.payload,
      expiresAt: command.expires_at,
    });
  }

  return { commands: deliverable, error: null };
}
