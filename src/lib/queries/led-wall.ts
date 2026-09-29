import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import {
  isMissingLedWallRelation,
  parseReportedObsScenes,
  resolveShowtimeHandoff,
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

function headlinerSceneId(value: unknown) {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return null;
  const id = (row as { led_wall_scene_id?: string | null }).led_wall_scene_id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

export async function applyLedShowtimeHandoff(client: Client, venueId: string, now = new Date()) {
  const { data: runtime, error: runtimeError } = await client
    .from("led_wall_runtime")
    .select("active_scene_id, activated_at")
    .eq("venue_id", venueId)
    .maybeSingle();
  if (runtimeError) return { scene: null as LedWallSceneRow | null, activeSceneId: null as string | null, ...missingOrError(runtimeError.message) };
  if (!runtime?.active_scene_id) {
    return { scene: null as LedWallSceneRow | null, activeSceneId: null as string | null, missingTable: false, error: null };
  }

  const { data: active, error: activeError } = await client
    .from("led_wall_scenes")
    .select("*")
    .eq("id", runtime.active_scene_id)
    .eq("venue_id", venueId)
    .maybeSingle();
  if (activeError) return { scene: null as LedWallSceneRow | null, activeSceneId: null as string | null, ...missingOrError(activeError.message) };
  if (!active) return { scene: null as LedWallSceneRow | null, activeSceneId: null as string | null, missingTable: false, error: null };

  let showStartsAt: Date | null = null;
  let headliner: { id: string; enabled: boolean } | null = null;
  if (active.rolls_until_showtime && active.enabled) {
    const { data: shows, error: showError } = await client
      .from("events")
      .select("id, starts_at")
      .eq("venue_id", venueId)
      .is("archived_at", null)
      .neq("status", "cancelled")
      .gt("ends_at", now.toISOString())
      .order("starts_at", { ascending: true })
      .limit(1);
    if (showError) return { scene: null as LedWallSceneRow | null, activeSceneId: null as string | null, missingTable: false, error: showError.message };
    const show = shows?.[0];
    if (show) {
      showStartsAt = new Date(show.starts_at);
      const { data: links, error: linkError } = await client
        .from("event_artists")
        .select("display_order, artists(led_wall_scene_id)")
        .eq("event_id", show.id)
        .order("display_order", { ascending: true })
        .limit(1);
      if (linkError) return { scene: null as LedWallSceneRow | null, activeSceneId: null as string | null, ...missingOrError(linkError.message) };
      const sceneId = headlinerSceneId(links?.[0]?.artists);
      if (sceneId) {
        const { data: headlinerScene, error: headlinerError } = await client
          .from("led_wall_scenes")
          .select("id, enabled")
          .eq("id", sceneId)
          .eq("venue_id", venueId)
          .maybeSingle();
        if (headlinerError) {
          return { scene: null as LedWallSceneRow | null, activeSceneId: null as string | null, ...missingOrError(headlinerError.message) };
        }
        if (headlinerScene) headliner = headlinerScene;
      }
    }
  }

  const handoff = resolveShowtimeHandoff({
    now,
    active: { id: active.id, enabled: active.enabled, rollsUntilShowtime: active.rolls_until_showtime },
    showStartsAt,
    headliner,
  });
  if (!handoff.advanceTo) {
    return { scene: active, activeSceneId: handoff.sceneId, missingTable: false, error: null };
  }

  const { error: updateError } = await client
    .from("led_wall_runtime")
    .update({ active_scene_id: handoff.advanceTo })
    .eq("venue_id", venueId);
  if (updateError) return { scene: null as LedWallSceneRow | null, activeSceneId: null as string | null, ...missingOrError(updateError.message) };

  const { data: nextScene, error: nextError } = await client
    .from("led_wall_scenes")
    .select("*")
    .eq("id", handoff.advanceTo)
    .eq("venue_id", venueId)
    .maybeSingle();
  if (nextError) return { scene: null as LedWallSceneRow | null, activeSceneId: null as string | null, ...missingOrError(nextError.message) };
  return {
    scene: nextScene,
    activeSceneId: nextScene?.enabled ? nextScene.id : null,
    missingTable: false,
    error: null,
  };
}
