import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { toStaffCameraSource, type CameraSourceRow } from "@/lib/cameras/map";
import { describeCameraConnectorLink, isMissingCameraRelation } from "@/lib/cameras/status";
import type { StaffCameraDevice, StaffCameraSource } from "@/lib/cameras/types";

type Client = SupabaseClient<Database>;

export type CameraLeaseRow = {
  cameraId: string;
  holderUserId: string;
  expiresAt: string;
};

export async function listCameraDevices(supabase: Client, venueId: string) {
  const { data, error } = await supabase
    .from("camera_connector_devices")
    .select(
      "id, label, last_seen_at, connector_version, hostname, remote_control_enabled, revoked_at",
    )
    .eq("venue_id", venueId)
    .order("created_at", { ascending: true });

  if (error) {
    return {
      devices: [] as StaffCameraDevice[],
      missingTable: isMissingCameraRelation(error.message),
      error: error.message,
    };
  }

  const devices: StaffCameraDevice[] = (data ?? []).map((row) => {
    const link = describeCameraConnectorLink({
      lastSeenAt: row.last_seen_at,
      remoteControlEnabled: row.remote_control_enabled,
      revokedAt: row.revoked_at,
    });
    return {
      id: row.id,
      label: row.label,
      lastSeenAt: row.last_seen_at,
      connectorVersion: row.connector_version,
      hostname: row.hostname,
      remoteControlEnabled: row.remote_control_enabled,
      revokedAt: row.revoked_at,
      online: link.online,
    };
  });

  return { devices, missingTable: false, error: null };
}

export async function listCameraSources(supabase: Client, venueId: string) {
  const { data, error } = await supabase
    .from("camera_sources")
    .select(
      "id, source_key, title, protocol, is_simulated, is_program_output, supports_ptz, supports_zoom, supports_presets, supports_preset_save, supports_focus, online, last_error, capabilities",
    )
    .eq("venue_id", venueId)
    .order("sort_order", { ascending: true });

  if (error) {
    return {
      cameras: [] as StaffCameraSource[],
      missingTable: isMissingCameraRelation(error.message),
      error: error.message,
    };
  }

  const cameras = (data ?? []).map((row) => toStaffCameraSource(row as CameraSourceRow));
  return { cameras, missingTable: false, error: null };
}

export async function listActiveCameraLeases(supabase: Client, venueId: string) {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("camera_control_leases")
    .select("camera_id, holder_user_id, expires_at")
    .eq("venue_id", venueId)
    .gt("expires_at", nowIso);

  if (error) {
    return {
      leases: [] as CameraLeaseRow[],
      missingTable: isMissingCameraRelation(error.message),
      error: error.message,
    };
  }

  return {
    leases: (data ?? []).map((row) => ({
      cameraId: row.camera_id,
      holderUserId: row.holder_user_id,
      expiresAt: row.expires_at,
    })),
    missingTable: false,
    error: null,
  };
}
