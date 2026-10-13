import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { isMissingDisplayDeviceRelation } from "@/lib/display-devices/status";
import type { StaffDisplayDevice, StaffDisplayDeviceStatus } from "@/lib/display-devices/types";

type Client = SupabaseClient<Database>;

export async function listStaffDisplayDevices(client: Client, venueId: string) {
  const { data, error } = await client
    .from("display_devices")
    .select("id, label, kind, revoked_at, last_seen_at, app_version, hostname, created_at")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: false });

  if (error) {
    return {
      devices: [] as StaffDisplayDevice[],
      missingTable: isMissingDisplayDeviceRelation(error.message),
      error: isMissingDisplayDeviceRelation(error.message) ? null : error.message,
    };
  }

  const devices = data ?? [];
  const ids = devices.filter((device) => !device.revoked_at).map((device) => device.id);
  const statusById = new Map<string, StaffDisplayDeviceStatus>();

  if (ids.length > 0) {
    const { data: statuses } = await client
      .from("display_device_status")
      .select(
        "device_id, obs_connected, program_scene, cache_bytes, cache_limit_bytes, assets_ready, assets_pending, manifest_revision, current_asset_id, playback_state, disk_free_bytes, last_error, reported_at",
      )
      .in("device_id", ids);
    for (const status of statuses ?? []) {
      statusById.set(status.device_id, {
        obs_connected: status.obs_connected,
        program_scene: status.program_scene,
        cache_bytes: status.cache_bytes,
        cache_limit_bytes: status.cache_limit_bytes,
        assets_ready: status.assets_ready,
        assets_pending: status.assets_pending,
        manifest_revision: status.manifest_revision,
        current_asset_id: status.current_asset_id,
        playback_state: status.playback_state,
        disk_free_bytes: status.disk_free_bytes,
        last_error: status.last_error,
        reported_at: status.reported_at,
      });
    }
  }

  return {
    devices: devices.map((device) => ({
      id: device.id,
      label: device.label,
      kind: device.kind,
      revoked_at: device.revoked_at,
      last_seen_at: device.last_seen_at,
      app_version: device.app_version,
      hostname: device.hostname,
      created_at: device.created_at,
      status: statusById.get(device.id) ?? null,
    })) as StaffDisplayDevice[],
    missingTable: false,
    error: null as string | null,
  };
}
