import type { Json } from "@/lib/database.types";
import type { ProductionCommandKind } from "@/lib/production/ecamm-endpoints";

export type ProductionCommandStatus =
  | "pending"
  | "queued"
  | "sent"
  | "acknowledged"
  | "confirmed"
  | "failed"
  | "expired"
  | "uncertain"
  | "rejected";

export type ProductionSessionStatus =
  | "planned"
  | "live"
  | "recording"
  | "paused"
  | "ended"
  | "unassigned";

export type ProductionMarkerEcammStatus =
  | "not_sent"
  | "queued"
  | "sent"
  | "acknowledged"
  | "failed"
  | "unknown";

export type ProductionSettings = {
  venue_id: string;
  production_device_id: string | null;
  allow_per_bus_mute: boolean;
  scene_favorites: Json;
  overlay_favorites: Json;
  updated_at: string;
  created_at: string;
};

export type ProductionDeviceStatus = {
  device_id: string;
  venue_id: string;
  connection_phase: string;
  approval_permission: string | null;
  ecamm_host: string | null;
  ecamm_hostname: string | null;
  ecamm_service_name: string | null;
  runner_version: string | null;
  ecamm_client_uuid: string | null;
  current_scene_id: string | null;
  current_scene_label: string | null;
  button_label: string | null;
  pause_button_label: string | null;
  broadcast_inference: string | null;
  broadcast_inference_source: string | null;
  viewers: number | null;
  preview_mode: boolean | null;
  zoom_in_meeting: boolean | null;
  last_success_at: string | null;
  last_error: string | null;
  endpoint_status: Json;
  state_fingerprint: string | null;
  raw_info_unmapped: Json;
  reported_at: string;
  updated_at: string;
};

export type ProductionSession = {
  id: string;
  venue_id: string;
  device_id: string | null;
  event_id: string | null;
  artist_ids: string[];
  status: ProductionSessionStatus;
  title: string | null;
  notes: string | null;
  set_number: number | null;
  started_at: string | null;
  ended_at: string | null;
  recording_started_at: string | null;
  recording_ended_at: string | null;
  ecamm_recording_path: string | null;
  performance_recording_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProductionMarker = {
  id: string;
  venue_id: string;
  session_id: string;
  label: string;
  notes: string | null;
  marked_at: string;
  relative_seconds: number | null;
  os_saved: boolean;
  ecamm_status: ProductionMarkerEcammStatus;
  ecamm_command_id: string | null;
  ecamm_error: string | null;
  created_by: string | null;
  created_at: string;
};

export type ProductionCommand = {
  id: string;
  venue_id: string;
  device_id: string;
  kind: string;
  endpoint: string | null;
  payload: Json;
  status: ProductionCommandStatus;
  result: Json | null;
  reject_reason: string | null;
  issued_by: string | null;
  issued_at: string;
  expires_at: string;
  sent_at: string | null;
  acknowledged_at: string | null;
  completed_at: string | null;
  dedupe_key: string | null;
  created_at: string;
};

export type ProductionRecordingEvent = {
  id: string;
  venue_id: string;
  device_id: string | null;
  session_id: string | null;
  event_type: "recording_started" | "recording_finished" | "broadcast_started" | "broadcast_finished";
  path_text: string | null;
  path_validated: boolean;
  idempotency_key: string;
  payload: Json;
  processed_at: string | null;
  created_at: string;
};

export type ProductionCommandDelivery = {
  id: string;
  kind: ProductionCommandKind | string;
  payload: Json;
  expiresAt: string;
  endpoint?: string | null;
  nonIdempotent?: boolean;
};

/** Human-facing command status — never present "accepted" as confirmed. */
export function productionCommandStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "pending":
    case "queued":
      return "queued";
    case "sent":
      return "sent";
    case "acknowledged":
      return "acknowledged";
    case "confirmed":
      return "confirmed";
    case "failed":
    case "rejected":
      return "failed";
    case "expired":
      return "expired";
    case "uncertain":
      return "unknown";
    default:
      return "unknown";
  }
}

export type EcammLiveSnapshot = {
  connected?: boolean;
  connectionPhase?: string | null;
  permission?: string | null;
  host?: string | null;
  hostname?: string | null;
  serviceName?: string | null;
  buttonLabel?: string | null;
  pauseButtonLabel?: string | null;
  currentSceneId?: string | null;
  currentSceneLabel?: string | null;
  viewers?: number | null;
  previewMode?: boolean | null;
  mute?: boolean | null;
  zoomInMeeting?: boolean | null;
  zoom?: Record<string, unknown> | null;
  volumes?: Record<string, unknown>;
  mutes?: Record<string, unknown>;
  lists?: {
    scenes?: Array<{ id: string; label?: string; current?: boolean; groupName?: string }>;
    overlays?: Array<{ id: string; label?: string; visible?: boolean; isComment?: boolean }>;
    inputs?: Array<{ id: string; label?: string }>;
    videos?: Array<{ id: string; label?: string }>;
    sounds?: Array<{ id: string; label?: string; folderName?: string }>;
    soundFolders?: Array<{ id: string; label?: string }>;
    audioFilters?: Array<{ id: string; label?: string }>;
    profiles?: Array<{ id: string; label?: string }>;
    channels?: Array<{ id: string; label?: string }>;
    sceneCount?: number;
    overlayCount?: number;
    inputCount?: number;
    soundCount?: number;
    profileCount?: number;
  };
  discovered?: Array<{
    hostname?: string;
    serviceName?: string;
    addresses?: string[];
    port?: number;
  }>;
  broadcast?: {
    inferred?: string;
    confidence?: string;
    source?: string;
    label?: string;
  } | null;
  favorites?: { scenes?: string[]; overlays?: string[] };
  allowPerBusMute?: boolean;
  lastSuccessAt?: string | null;
  lastError?: string | null;
  endpointSupport?: Record<string, { supported?: boolean | null; lastError?: string | null }>;
};
