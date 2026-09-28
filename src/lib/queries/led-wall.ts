import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import {
  isMissingLedWallRelation,
  parseReportedObsScenes,
  toPublicLedMedia,
  type PublicLedMedia,
} from "@/lib/screens/led-wall";

type Client = SupabaseClient<Database>;

export type LedWallSceneRow = Database["public"]["Tables"]["led_wall_scenes"]["Row"];
export type LedWallSettingsRow = Database["public"]["Tables"]["led_wall_settings"]["Row"];
export type LedWallRuntimeRow = Database["public"]["Tables"]["led_wall_runtime"]["Row"];

export type LedWallAgentSnapshot = {
  lastSeenAt: string | null;
  obsConnected: boolean;
  programScene: string | null;
  obsScenes: string[];
};

function missingOrError(message: string) {
  return { missingTable: isMissingLedWallRelation(message), error: message };
}

export async function listLedWallScenes(client: Client, venueId: string) {
  const { data, error } = await client
    .from("led_wall_scenes")
    .select("*")
    .eq("venue_id", venueId)
    .order("sort_order", { ascending: true });
  if (error) return { scenes: [] as LedWallSceneRow[], ...missingOrError(error.message) };
  return { scenes: data ?? [], missingTable: false, error: null };
}

export async function getLedWallSettings(client: Client, venueId: string) {
  const { data, error } = await client.from("led_wall_settings").select("*").eq("venue_id", venueId).maybeSingle();
  if (error) return { settings: null as LedWallSettingsRow | null, ...missingOrError(error.message) };
  return { settings: data, missingTable: false, error: null };
}

export async function getLedWallRuntime(client: Client, venueId: string) {
  const { data, error } = await client.from("led_wall_runtime").select("*").eq("venue_id", venueId).maybeSingle();
  if (error) return { runtime: null as LedWallRuntimeRow | null, ...missingOrError(error.message) };
  return { runtime: data, missingTable: false, error: null };
}

export async function getLedWallAgentStatus(client: Client, venueId: string): Promise<{
  agent: LedWallAgentSnapshot;
  missingTable: boolean;
  error: string | null;
}> {
  const { data, error } = await client.from("led_wall_agent_status").select("*").eq("venue_id", venueId).maybeSingle();
  if (error) {
    return {
      agent: { lastSeenAt: null, obsConnected: false, programScene: null, obsScenes: [] },
      ...missingOrError(error.message),
    };
  }
  return {
    agent: {
      lastSeenAt: data?.last_seen_at ?? null,
      obsConnected: data?.obs_connected ?? false,
      programScene: data?.program_scene ?? null,
      obsScenes: parseReportedObsScenes(data?.obs_scenes),
    },
    missingTable: false,
    error: null,
  };
}

export async function getPublicLedMedia(
  client: Client,
  venueId = FLO_BAMA_VENUE_ID,
): Promise<{ media: PublicLedMedia | null; error: string | null }> {
  const { data, error } = await client
    .from("led_wall_active_media")
    .select("scene_id, title, media_kind, public_url")
    .eq("venue_id", venueId)
    .maybeSingle();
  if (error) {
    if (isMissingLedWallRelation(error.message)) return { media: null, error: null };
    return { media: null, error: error.message };
  }
  return {
    media: toPublicLedMedia(
      data
        ? {
            scene_id: data.scene_id,
            title: data.title,
            public_url: data.public_url,
            media_kind: data.media_kind,
          }
        : null,
    ),
    error: null,
  };
}
