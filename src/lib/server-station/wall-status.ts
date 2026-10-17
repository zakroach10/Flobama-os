import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { LED_AGENT_STALE_MS } from "@/lib/constants";
import { isMissingServerStationRelation } from "@/lib/auth/server-station";
import { DISPLAY_DEVICE_STALE_MS, isDisplayDeviceStale } from "@/lib/display-devices/types";
import type { ServerStationWallStatus } from "@/lib/server-station/wall-status-shared";

export type { ServerStationWallStatus } from "@/lib/server-station/wall-status-shared";
export { wallStatusLabel } from "@/lib/server-station/wall-status-shared";

type Client = SupabaseClient<Database>;

function isTimestampFresh(iso: string | null | undefined, windowMs: number, now = Date.now()) {
  if (!iso) return false;
  const seen = Date.parse(iso);
  return Number.isFinite(seen) && now - seen < windowMs;
}

/**
 * Wall is online when either the classic OBS booth agent or a paired LED local
 * runner has checked in recently. Local runners only heartbeat display_devices —
 * they do not update led_wall_agent_status.
 */
export async function getServerStationWallStatus(client: Client, venueId: string): Promise<ServerStationWallStatus> {
  const now = Date.now();

  const [agentRes, devicesRes, overrideRes, runtimeRes] = await Promise.all([
    client
      .from("led_wall_agent_status")
      .select("last_seen_at, obs_connected")
      .eq("venue_id", venueId)
      .maybeSingle(),
    client
      .from("display_devices")
      .select("id, last_seen_at, revoked_at")
      .eq("venue_id", venueId)
      .eq("kind", "led_runner")
      .is("revoked_at", null)
      .order("last_seen_at", { ascending: false })
      .limit(8),
    client
      .from("led_wall_override_listings")
      .select("title, ends_at")
      .eq("venue_id", venueId)
      .maybeSingle(),
    client
      .from("led_wall_runtime")
      .select("active_scene_id, active_playlist_id, activation_source")
      .eq("venue_id", venueId)
      .maybeSingle(),
  ]);

  const agent = agentRes.data;
  // Use the more lenient display-device window for the booth agent too — a 15s
  // cutoff falsely marks the wall offline between heartbeats on a busy kiosk.
  const agentFresh = isTimestampFresh(
    agent?.last_seen_at,
    Math.max(LED_AGENT_STALE_MS, DISPLAY_DEVICE_STALE_MS),
    now,
  );
  const agentConnected = agentFresh;

  const runners = devicesRes.data ?? [];
  const onlineRunner = runners.find((device) => !isDisplayDeviceStale(device.last_seen_at, now));
  const runnerConnected = Boolean(onlineRunner);

  const connected = agentConnected || runnerConnected;
  const link = runnerConnected && !agentConnected ? "local_runner" : agentConnected ? "agent" : null;

  const offlineReason = connected
    ? null
    : "The wall has not checked in recently. You can still change scenes — they will play when the local runner or booth computer reconnects.";

  const override = overrideRes.data;
  if (override?.title) {
    return {
      connected,
      link,
      currentlyPlaying: override.title,
      offlineReason,
      activationSource: "server_override",
      protectedMode: false,
    };
  }

  const runtime = runtimeRes.data;
  let currentlyPlaying = "House Ads";
  let protectedMode = false;

  if (runtime?.activation_source === "artist_auto") {
    currentlyPlaying = "Today’s Band";
    protectedMode = true;
  } else if (runtime?.active_playlist_id) {
    const { data: playlist } = await client
      .from("led_wall_playlists")
      .select("name")
      .eq("id", runtime.active_playlist_id)
      .maybeSingle();
    currentlyPlaying = playlist?.name || "House Ads";
  } else if (runtime?.active_scene_id) {
    const { data: scene } = await client
      .from("led_wall_scenes")
      .select("title, kind")
      .eq("id", runtime.active_scene_id)
      .maybeSingle();
    currentlyPlaying = scene?.title || "LED Scene";
    if (scene?.kind === "trivia" || scene?.kind === "audience") protectedMode = true;
  }

  return {
    connected,
    link,
    currentlyPlaying,
    offlineReason,
    activationSource: runtime?.activation_source ?? null,
    protectedMode,
  };
}

export function isMissingWallStatusRelation(message: string | null | undefined) {
  return (
    isMissingServerStationRelation(message) ||
    /led_wall_agent_status|led_wall_runtime|display_devices/i.test(message ?? "")
  );
}
