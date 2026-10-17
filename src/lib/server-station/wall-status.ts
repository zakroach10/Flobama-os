import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { LED_AGENT_STALE_MS } from "@/lib/constants";
import { isMissingServerStationRelation } from "@/lib/auth/server-station";
import type { ServerStationWallStatus } from "@/lib/server-station/wall-status-shared";

export type { ServerStationWallStatus } from "@/lib/server-station/wall-status-shared";
export { wallStatusLabel } from "@/lib/server-station/wall-status-shared";

type Client = SupabaseClient<Database>;

export async function getServerStationWallStatus(client: Client, venueId: string): Promise<ServerStationWallStatus> {
  const { data: agent } = await client
    .from("led_wall_agent_status")
    .select("last_seen_at, obs_connected")
    .eq("venue_id", venueId)
    .maybeSingle();

  const lastSeen = agent?.last_seen_at ? Date.parse(agent.last_seen_at) : NaN;
  const fresh = Number.isFinite(lastSeen) && Date.now() - lastSeen < LED_AGENT_STALE_MS;
  const connected = Boolean(agent?.obs_connected && fresh) || fresh;

  const { data: override } = await client
    .from("led_wall_override_listings")
    .select("title, ends_at")
    .eq("venue_id", venueId)
    .maybeSingle();

  if (override?.title) {
    return {
      connected,
      currentlyPlaying: override.title,
      offlineReason: connected ? null : "The LED wall computer is offline. You can still prepare slides; they will play when the wall reconnects.",
      activationSource: "server_override",
      protectedMode: false,
    };
  }

  const { data: runtime } = await client
    .from("led_wall_runtime")
    .select("active_scene_id, active_playlist_id, activation_source")
    .eq("venue_id", venueId)
    .maybeSingle();

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
    currentlyPlaying,
    offlineReason: connected
      ? null
      : "The LED wall computer is offline. Scene changes are paused until it reconnects.",
    activationSource: runtime?.activation_source ?? null,
    protectedMode,
  };
}

export function isMissingWallStatusRelation(message: string | null | undefined) {
  return isMissingServerStationRelation(message) || /led_wall_agent_status|led_wall_runtime/i.test(message ?? "");
}
