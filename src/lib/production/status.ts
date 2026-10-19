import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";

type Admin = SupabaseClient<Database>;

export type EcammHeartbeatPayload = {
  connected?: boolean;
  connectionPhase?: string | null;
  permission?: string | null;
  host?: string | null;
  hostname?: string | null;
  serviceName?: string | null;
  uuid?: string | null;
  clientVersion?: string | null;
  lastSuccessAt?: string | null;
  lastError?: string | null;
  currentSceneId?: string | null;
  currentSceneLabel?: string | null;
  buttonLabel?: string | null;
  pauseButtonLabel?: string | null;
  broadcast?: {
    inferred?: string;
    confidence?: string;
    source?: string;
    label?: string;
    state?: string;
  } | null;
  viewers?: number | null;
  previewMode?: boolean | null;
  zoomInMeeting?: boolean | null;
  stateFingerprint?: string | null;
  unmappedKeys?: unknown[];
  endpointSupport?: Record<string, unknown>;
  lists?: Record<string, unknown>;
  volumes?: Record<string, unknown>;
  mutes?: Record<string, unknown>;
  zoom?: Record<string, unknown> | null;
  discovered?: unknown[];
  favorites?: Record<string, unknown>;
  allowPerBusMute?: boolean;
  mute?: boolean | null;
  currentMode?: string | null;
  [key: string]: unknown;
};

function sceneLabelFromLists(ecamm: EcammHeartbeatPayload): string | null {
  const sceneId = ecamm.currentSceneId;
  if (!sceneId) return ecamm.currentSceneLabel ?? null;
  const scenes = ecamm.lists?.scenes;
  if (Array.isArray(scenes)) {
    const match = scenes.find(
      (item) => item && typeof item === "object" && "id" in item && String((item as { id: unknown }).id) === sceneId,
    ) as { label?: string } | undefined;
    if (match?.label) return match.label;
  }
  return ecamm.currentSceneLabel ?? null;
}

function broadcastFields(ecamm: EcammHeartbeatPayload) {
  const broadcast = ecamm.broadcast && typeof ecamm.broadcast === "object" ? ecamm.broadcast : null;
  const inferred =
    (broadcast?.inferred || broadcast?.state || broadcast?.label || null) as string | null;
  const source =
    (broadcast?.source ||
      (broadcast ? "button_label_inference" : null) ||
      null) as string | null;
  return { inferred, source };
}

/**
 * Upsert production_device_status only when stateFingerprint changes (or first write).
 * Full ecamm heartbeat (lists, volumes, discovered) is stored under endpoint_status.live.
 */
export async function upsertProductionDeviceStatus(
  client: Admin,
  args: {
    deviceId: string;
    venueId: string;
    ecamm: EcammHeartbeatPayload;
    runnerVersion?: string | null;
    reportedAt?: string;
  },
) {
  const now = args.reportedAt ?? new Date().toISOString();
  const fingerprint =
    typeof args.ecamm.stateFingerprint === "string" && args.ecamm.stateFingerprint.trim()
      ? args.ecamm.stateFingerprint.trim()
      : null;

  if (fingerprint) {
    const { data: prior } = await client
      .from("production_device_status")
      .select("state_fingerprint")
      .eq("device_id", args.deviceId)
      .maybeSingle();
    if (prior?.state_fingerprint && prior.state_fingerprint === fingerprint) {
      // Still bump reported_at lightly so "last update" stays honest without rewriting snapshot.
      await client
        .from("production_device_status")
        .update({ reported_at: now })
        .eq("device_id", args.deviceId);
      return { wrote: false, error: null as string | null };
    }
  }

  const { inferred, source } = broadcastFields(args.ecamm);
  const liveSnapshot = {
    ...args.ecamm,
    storedAt: now,
  };

  const { error } = await client.from("production_device_status").upsert(
    {
      device_id: args.deviceId,
      venue_id: args.venueId,
      connection_phase: String(args.ecamm.connectionPhase || (args.ecamm.connected ? "connected" : "offline")),
      approval_permission: args.ecamm.permission ?? null,
      ecamm_host: args.ecamm.host ?? null,
      ecamm_hostname: args.ecamm.hostname ?? null,
      ecamm_service_name: args.ecamm.serviceName ?? null,
      runner_version: args.runnerVersion ?? args.ecamm.clientVersion ?? null,
      ecamm_client_uuid: args.ecamm.uuid ?? null,
      current_scene_id: args.ecamm.currentSceneId ?? null,
      current_scene_label: sceneLabelFromLists(args.ecamm),
      button_label: args.ecamm.buttonLabel ?? null,
      pause_button_label: args.ecamm.pauseButtonLabel ?? null,
      broadcast_inference: inferred,
      broadcast_inference_source: source,
      viewers: typeof args.ecamm.viewers === "number" ? args.ecamm.viewers : null,
      preview_mode: typeof args.ecamm.previewMode === "boolean" ? args.ecamm.previewMode : null,
      zoom_in_meeting: typeof args.ecamm.zoomInMeeting === "boolean" ? args.ecamm.zoomInMeeting : null,
      last_success_at: args.ecamm.lastSuccessAt ?? null,
      last_error: args.ecamm.lastError ?? null,
      endpoint_status: {
        support: args.ecamm.endpointSupport ?? {},
        live: liveSnapshot,
      } as Json,
      state_fingerprint: fingerprint,
      raw_info_unmapped: (args.ecamm.unmappedKeys ?? []) as Json,
      reported_at: now,
    },
    { onConflict: "device_id" },
  );

  if (error) return { wrote: false, error: error.message };
  return { wrote: true, error: null as string | null };
}

export function liveSnapshotFromStatus(
  endpointStatus: Json | null | undefined,
): EcammHeartbeatPayload | null {
  if (!endpointStatus || typeof endpointStatus !== "object" || Array.isArray(endpointStatus)) {
    return null;
  }
  const live = (endpointStatus as { live?: unknown }).live;
  if (!live || typeof live !== "object" || Array.isArray(live)) return null;
  return live as EcammHeartbeatPayload;
}
