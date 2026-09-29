import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { toStaffCameraSource, toStaffInventoryItem, type CameraSourceRow } from "@/lib/cameras/map";
import { describeCameraConnectorLink, isMissingCameraRelation } from "@/lib/cameras/status";
import type {
  DiscoveredNdiSource,
  StaffCameraDevice,
  StaffCameraInventoryItem,
  StaffCameraSource,
} from "@/lib/cameras/types";

type Client = SupabaseClient<Database>;

export type CameraLeaseRow = {
  cameraId: string;
  holderUserId: string;
  expiresAt: string;
};

function parseDiscoveredNdi(value: unknown): DiscoveredNdiSource[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const name = String(row.name ?? "").trim();
      const sourceKey = String(row.sourceKey ?? "").trim();
      if (!name || !sourceKey) return null;
      const url = row.urlAddress == null ? null : String(row.urlAddress).trim() || null;
      return { name, sourceKey, urlAddress: url };
    })
    .filter((item): item is DiscoveredNdiSource => Boolean(item));
}

export async function listCameraDevices(supabase: Client, venueId: string) {
  const primary = await supabase
    .from("camera_connector_devices")
    .select(
      "id, label, last_seen_at, connector_version, hostname, remote_control_enabled, revoked_at, status_detail, discovered_ndi",
    )
    .eq("venue_id", venueId)
    .order("created_at", { ascending: true });

  let data = primary.data;
  if (primary.error && /discovered_ndi/i.test(primary.error.message)) {
    const fallback = await supabase
      .from("camera_connector_devices")
      .select(
        "id, label, last_seen_at, connector_version, hostname, remote_control_enabled, revoked_at, status_detail",
      )
      .eq("venue_id", venueId)
      .order("created_at", { ascending: true });
    if (fallback.error) {
      return {
        devices: [] as StaffCameraDevice[],
        missingTable: isMissingCameraRelation(fallback.error.message),
        error: fallback.error.message,
      };
    }
    data = fallback.data?.map((row) => ({ ...row, discovered_ndi: [] })) ?? [];
  } else if (primary.error) {
    return {
      devices: [] as StaffCameraDevice[],
      missingTable: isMissingCameraRelation(primary.error.message),
      error: primary.error.message,
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
      statusDetail: (row as { status_detail?: string | null }).status_detail ?? null,
      discoveredNdi: parseDiscoveredNdi((row as { discovered_ndi?: unknown }).discovered_ndi),
    };
  });

  return { devices, missingTable: false, error: null };
}

export async function listCameraSources(supabase: Client, venueId: string) {
  const { data, error } = await supabase
    .from("camera_sources")
    .select(
      "id, source_key, title, protocol, is_simulated, is_program_output, supports_ptz, supports_zoom, supports_presets, supports_preset_save, supports_focus, online, last_error, capabilities, connection_target, connection_port, link_status, inventory_id",
    )
    .eq("venue_id", venueId)
    .order("sort_order", { ascending: true });

  if (error) {
    // Older schema without inventory columns.
    if (/connection_target|link_status|inventory_id/i.test(error.message)) {
      const fallback = await supabase
        .from("camera_sources")
        .select(
          "id, source_key, title, protocol, is_simulated, is_program_output, supports_ptz, supports_zoom, supports_presets, supports_preset_save, supports_focus, online, last_error, capabilities",
        )
        .eq("venue_id", venueId)
        .order("sort_order", { ascending: true });
      if (fallback.error) {
        return {
          cameras: [] as StaffCameraSource[],
          missingTable: isMissingCameraRelation(fallback.error.message),
          error: fallback.error.message,
        };
      }
      const cameras = (fallback.data ?? []).map((row) =>
        toStaffCameraSource({
          ...(row as CameraSourceRow),
          connection_target: null,
          connection_port: null,
          link_status: row.is_simulated ? "simulated" : "unknown",
          inventory_id: null,
        }),
      );
      return { cameras, missingTable: false, error: null };
    }
    return {
      cameras: [] as StaffCameraSource[],
      missingTable: isMissingCameraRelation(error.message),
      error: error.message,
    };
  }

  const cameras = (data ?? []).map((row) => toStaffCameraSource(row as CameraSourceRow));
  return { cameras, missingTable: false, error: null };
}

export async function listCameraInventory(supabase: Client, venueId: string) {
  const { data, error } = await supabase
    .from("camera_inventory")
    .select(
      "id, source_key, title, protocol, connection_target, connection_port, is_program_output, supports_ptz, supports_zoom, supports_presets, supports_preset_save, supports_focus, enabled, notes, sort_order",
    )
    .eq("venue_id", venueId)
    .order("sort_order", { ascending: true });

  if (error) {
    return {
      inventory: [] as StaffCameraInventoryItem[],
      missingTable: isMissingCameraRelation(error.message) || /camera_inventory/i.test(error.message),
      error: error.message,
    };
  }

  return {
    inventory: (data ?? []).map((row) => toStaffInventoryItem(row)),
    missingTable: false,
    error: null,
  };
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
