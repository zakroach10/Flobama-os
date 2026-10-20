import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { isMissingServerStationRelation } from "@/lib/auth/server-station";
import {
  loadAdRollItems,
  promoteDueServerOverride,
  rebaseLiveAdRoll,
  restoreAdRollAfterOverride,
} from "@/lib/server-station/ad-roll";

type Client = SupabaseClient<Database>;

export type LedWallProtectedReason =
  | { protected: false }
  | { protected: true; reason: string; canQueue: true };

export async function getLedWallProtection(client: Client, venueId: string): Promise<LedWallProtectedReason> {
  const { data: runtime, error } = await client
    .from("led_wall_runtime")
    .select("active_scene_id, active_playlist_id, activation_source")
    .eq("venue_id", venueId)
    .maybeSingle();

  if (error && !isMissingServerStationRelation(error.message) && !/led_wall_runtime/i.test(error.message)) {
    return { protected: false };
  }

  if (!runtime) return { protected: false };

  if (runtime.activation_source === "artist_auto") {
    return {
      protected: true,
      reason: "The wall is on the live band schedule right now. We can add this to the rotation instead of interrupting the show.",
      canQueue: true,
    };
  }

  if (runtime.active_scene_id) {
    const { data: scene } = await client
      .from("led_wall_scenes")
      .select("kind, title")
      .eq("id", runtime.active_scene_id)
      .maybeSingle();
    if (scene?.kind === "trivia" || scene?.kind === "audience") {
      return {
        protected: true,
        reason: `${scene.title} is live. We can add this to the rotation instead of interrupting.`,
        canQueue: true,
      };
    }
  }

  return { protected: false };
}

export async function clearExpiredLedOverride(client: Client, venueId: string, now = new Date()) {
  const { data: override, error } = await client
    .from("led_wall_overrides")
    .select(
      "venue_id, ends_at, starts_at, previous_playlist_id, previous_scene_id, previous_activation_source, resume_playlist_item_id",
    )
    .eq("venue_id", venueId)
    .maybeSingle();

  if (error) {
    if (isMissingServerStationRelation(error.message)) return { cleared: false, missingTable: true };
    return { cleared: false, missingTable: false, error: error.message };
  }
  if (!override) return { cleared: false, missingTable: false };
  if (Date.parse(override.ends_at) > now.getTime()) return { cleared: false, missingTable: false };

  await client.from("led_wall_overrides").delete().eq("venue_id", venueId);
  // Land on the start of the next ad. Do not resume in the middle of a slide.
  await restoreAdRollAfterOverride(client, venueId, override, now);

  return { cleared: true, missingTable: false };
}

/**
 * Wall player reports a YouTube take finished — clear the override and resume house ads.
 * Only succeeds when `sceneId` is the active override scene with media_kind youtube.
 */
export async function completeYoutubeWallPlayback(
  client: Client,
  venueId: string,
  sceneId: string,
  now = new Date(),
) {
  const { data: override, error } = await client
    .from("led_wall_overrides")
    .select(
      "venue_id, scene_id, server_item_id, starts_at, previous_playlist_id, previous_scene_id, previous_activation_source, resume_playlist_item_id",
    )
    .eq("venue_id", venueId)
    .maybeSingle();

  if (error) {
    if (isMissingServerStationRelation(error.message)) {
      return { ok: false as const, message: "Server Station tables are missing." };
    }
    return { ok: false as const, message: error.message };
  }
  if (!override || override.scene_id !== sceneId) {
    return { ok: false as const, message: "That YouTube take is no longer on the wall." };
  }

  const { data: scene } = await client
    .from("led_wall_scenes")
    .select("id, media_kind")
    .eq("id", sceneId)
    .eq("venue_id", venueId)
    .maybeSingle();
  if (scene?.media_kind !== "youtube") {
    return { ok: false as const, message: "That scene is not a YouTube take." };
  }

  await client.from("led_wall_overrides").delete().eq("venue_id", venueId);
  if (override.server_item_id) {
    await client
      .from("led_server_items")
      .update({ status: "expired" })
      .eq("id", override.server_item_id)
      .eq("venue_id", venueId);
  }
  await restoreAdRollAfterOverride(client, venueId, override, now);
  return { ok: true as const, message: "Returned to normal programming." };
}

export async function expireServerStationItems(client: Client, venueId: string, now = new Date()) {
  const nowIso = now.toISOString();
  const { data: expired, error } = await client
    .from("led_server_items")
    .select("id, scene_id, playlist_item_id")
    .eq("venue_id", venueId)
    .in("status", ["active", "queued"])
    .lte("ends_at", nowIso);

  if (error) {
    if (isMissingServerStationRelation(error.message)) return { removed: 0, missingTable: true };
    return { removed: 0, missingTable: false, error: error.message };
  }

  const playlistIds = new Set<string>();
  const beforeByPlaylist = new Map<string, Awaited<ReturnType<typeof loadAdRollItems>>["items"]>();
  for (const item of expired ?? []) {
    if (!item.playlist_item_id) continue;
    const { data: membership } = await client
      .from("led_wall_playlist_items")
      .select("playlist_id")
      .eq("id", item.playlist_item_id)
      .eq("venue_id", venueId)
      .maybeSingle();
    if (!membership?.playlist_id || beforeByPlaylist.has(membership.playlist_id)) continue;
    const loaded = await loadAdRollItems(client, venueId, membership.playlist_id);
    beforeByPlaylist.set(membership.playlist_id, loaded.items);
    playlistIds.add(membership.playlist_id);
  }

  let removed = 0;
  for (const item of expired ?? []) {
    if (item.playlist_item_id) {
      await client
        .from("led_wall_playlist_items")
        .update({ enabled: false, archived_at: nowIso })
        .eq("id", item.playlist_item_id)
        .eq("venue_id", venueId);
    }
    await client
      .from("led_server_items")
      .update({ status: "expired" })
      .eq("id", item.id)
      .eq("venue_id", venueId);
    removed += 1;
  }

  for (const playlistId of playlistIds) {
    await rebaseLiveAdRoll(client, venueId, playlistId, beforeByPlaylist.get(playlistId) ?? [], now);
  }

  return { removed, missingTable: false };
}

export async function promoteDueServerStationOverride(client: Client, venueId: string, now = new Date()) {
  return promoteDueServerOverride(client, venueId, now);
}
