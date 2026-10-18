import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  cursorAfterPlaylistEdit,
  insertionAfterCurrentAd,
  ledPlaylistPosition,
  rebaseLedPlaylistStartedAt,
  type LedPlaylistClockItem,
} from "@/lib/screens/led-playlists";

type Client = SupabaseClient<Database>;

export type AdRollItem = LedPlaylistClockItem & { sortOrder: number };

type RuntimeRow = {
  active_playlist_id: string | null;
  active_scene_id: string | null;
  activation_source: string | null;
  activated_at: string | null;
};

export async function loadAdRollItems(client: Client, venueId: string, playlistId: string) {
  const { data, error } = await client
    .from("led_wall_playlist_items")
    .select("id, sort_order, duration_seconds")
    .eq("venue_id", venueId)
    .eq("playlist_id", playlistId)
    .eq("enabled", true)
    .is("archived_at", null)
    .order("sort_order", { ascending: true });
  if (error) return { items: [] as AdRollItem[], error: error.message };
  const items = (data ?? []).map((row) => ({
    id: row.id,
    sortOrder: row.sort_order,
    durationSeconds: row.duration_seconds,
  }));
  return { items, error: null };
}

async function readRuntime(client: Client, venueId: string) {
  const { data, error } = await client
    .from("led_wall_runtime")
    .select("active_playlist_id, active_scene_id, activation_source, activated_at")
    .eq("venue_id", venueId)
    .maybeSingle();
  if (error) return { runtime: null as RuntimeRow | null, error: error.message };
  return { runtime: (data as RuntimeRow | null) ?? null, error: null };
}

function playlistIsOnScreen(runtime: RuntimeRow | null, playlistId: string) {
  if (!runtime?.active_playlist_id || runtime.active_playlist_id !== playlistId) return false;
  if (runtime.activation_source === "artist_auto" || runtime.activation_source === "server_override") {
    return false;
  }
  return true;
}

/** Keep the on-screen ad pinned when this playlist's membership changes. */
export async function rebaseLiveAdRoll(
  client: Client,
  venueId: string,
  playlistId: string,
  before: AdRollItem[],
  now = new Date(),
) {
  const { runtime } = await readRuntime(client, venueId);
  if (!playlistIsOnScreen(runtime, playlistId)) return { rebased: false };
  const { items: after } = await loadAdRollItems(client, venueId, playlistId);
  const startedAt = cursorAfterPlaylistEdit(
    before,
    runtime?.activated_at ?? null,
    after,
    now.getTime(),
  );
  if (!startedAt) return { rebased: false };
  const { error } = await client
    .from("led_wall_runtime")
    .update({ activated_at: startedAt })
    .eq("venue_id", venueId)
    .eq("active_playlist_id", playlistId);
  return { rebased: !error, error: error?.message ?? null };
}

/**
 * Insert a server slide so it is the next ad after the one already playing.
 * The current ad keeps its remaining time.
 */
export async function insertServerSlideAfterCurrentAd(
  client: Client,
  input: {
    venueId: string;
    playlistId: string;
    sceneId: string;
    durationSeconds: number;
    now?: Date;
  },
) {
  const now = input.now ?? new Date();
  const { runtime } = await readRuntime(client, input.venueId);
  const { items: before, error: loadError } = await loadAdRollItems(client, input.venueId, input.playlistId);
  if (loadError) return { ok: false as const, message: loadError };

  const live = playlistIsOnScreen(runtime, input.playlistId);
  let maxSort = -1;
  for (const item of before) maxSort = Math.max(maxSort, item.sortOrder);
  const plan = live
    ? insertionAfterCurrentAd(before, runtime?.activated_at ?? null, now.getTime())
    : {
        sortOrder: maxSort + 1,
        shiftAfterSortOrder: null as number | null,
      };

  if (plan.shiftAfterSortOrder != null) {
    const { data: later, error: laterError } = await client
      .from("led_wall_playlist_items")
      .select("id, sort_order")
      .eq("venue_id", input.venueId)
      .eq("playlist_id", input.playlistId)
      .gt("sort_order", plan.shiftAfterSortOrder);
    if (laterError) return { ok: false as const, message: laterError.message };
    const rows = [...(later ?? [])].sort((left, right) => right.sort_order - left.sort_order);
    for (const row of rows) {
      const { error } = await client
        .from("led_wall_playlist_items")
        .update({ sort_order: row.sort_order + 1 })
        .eq("id", row.id)
        .eq("venue_id", input.venueId);
      if (error) return { ok: false as const, message: error.message };
    }
  }

  const { data: itemRow, error: itemInsertError } = await client
    .from("led_wall_playlist_items")
    .insert({
      playlist_id: input.playlistId,
      venue_id: input.venueId,
      scene_id: input.sceneId,
      duration_seconds: input.durationSeconds,
      sort_order: plan.sortOrder,
      enabled: true,
    })
    .select("id")
    .single();
  if (itemInsertError || !itemRow) {
    return { ok: false as const, message: itemInsertError?.message ?? "Could not add that slide to the rotation." };
  }

  if (live) {
    await rebaseLiveAdRoll(client, input.venueId, input.playlistId, before, now);
  }

  return {
    ok: true as const,
    playlistItemId: itemRow.id,
    playsAfterCurrentAd: live,
  };
}

export type AdRollHold = {
  startsAt: string;
  remainingMs: number;
  resumePlaylistItemId: string | null;
  playlistId: string;
  previousSceneId: string | null;
  previousActivationSource: string | null;
};

/** How long the ad already on screen still has, when the wall is in a rotating playlist. */
export async function readAdRollHold(client: Client, venueId: string, now = new Date()): Promise<AdRollHold | null> {
  const { runtime } = await readRuntime(client, venueId);
  if (!runtime?.active_playlist_id) return null;
  if (runtime.activation_source === "artist_auto" || runtime.activation_source === "server_override") {
    return null;
  }
  const { items } = await loadAdRollItems(client, venueId, runtime.active_playlist_id);
  if (items.length === 0) return null;
  const position = ledPlaylistPosition(items, runtime.activated_at, now.getTime());
  if (position.remainingSeconds < 1) return null;
  const next = items[(position.index + 1) % items.length];
  const remainingMs = Math.round(position.remainingSeconds * 1000);
  return {
    startsAt: new Date(now.getTime() + remainingMs).toISOString(),
    remainingMs,
    resumePlaylistItemId: next?.id ?? null,
    playlistId: runtime.active_playlist_id,
    previousSceneId: runtime.active_scene_id,
    previousActivationSource: runtime.activation_source,
  };
}

/** Once a deferred Show Now is due, mark runtime so band auto-roll will not cut it. */
export async function promoteDueServerOverride(client: Client, venueId: string, now = new Date()) {
  const { data: override, error } = await client
    .from("led_wall_overrides")
    .select("scene_id, starts_at, ends_at")
    .eq("venue_id", venueId)
    .maybeSingle();
  if (error || !override) return { promoted: false };
  if (Date.parse(override.starts_at) > now.getTime()) return { promoted: false };
  if (Date.parse(override.ends_at) <= now.getTime()) return { promoted: false };

  const { runtime } = await readRuntime(client, venueId);
  if (runtime?.activation_source === "server_override" && runtime.active_scene_id === override.scene_id) {
    return { promoted: false };
  }

  const { error: runtimeError } = await client.from("led_wall_runtime").upsert(
    {
      venue_id: venueId,
      active_scene_id: override.scene_id,
      active_playlist_id: null,
      activation_source: "server_override",
      auto_event_id: null,
      auto_artist_id: null,
    },
    { onConflict: "venue_id" },
  );
  return { promoted: !runtimeError };
}

export async function restoreAdRollAfterOverride(
  client: Client,
  venueId: string,
  override: {
    previous_playlist_id: string | null;
    previous_scene_id: string | null;
    previous_activation_source: string | null;
    resume_playlist_item_id: string | null;
  },
  now = new Date(),
) {
  const { data: settings } = await client
    .from("led_wall_settings")
    .select("default_playlist_id")
    .eq("venue_id", venueId)
    .maybeSingle();
  const playlistId = settings?.default_playlist_id ?? override.previous_playlist_id ?? null;

  if (playlistId) {
    const { error } = await client.from("led_wall_runtime").upsert(
      {
        venue_id: venueId,
        active_scene_id: null,
        active_playlist_id: playlistId,
        activation_source: "ad_roll",
        auto_event_id: null,
        auto_artist_id: null,
      },
      { onConflict: "venue_id" },
    );
    if (error) return { ok: false as const, message: error.message };

    const { items } = await loadAdRollItems(client, venueId, playlistId);
    if (items.length === 0) return { ok: true as const };
    const resumeIndex = override.resume_playlist_item_id
      ? items.findIndex((item) => item.id === override.resume_playlist_item_id)
      : 0;
    const startedAt = rebaseLedPlaylistStartedAt(
      items,
      resumeIndex >= 0 ? resumeIndex : 0,
      0,
      now.getTime(),
    );
    await client
      .from("led_wall_runtime")
      .update({ activated_at: startedAt })
      .eq("venue_id", venueId)
      .eq("active_playlist_id", playlistId);
    return { ok: true as const };
  }

  if (override.previous_scene_id) {
    await client.from("led_wall_runtime").upsert(
      {
        venue_id: venueId,
        active_scene_id: override.previous_scene_id,
        active_playlist_id: null,
        activation_source:
          override.previous_activation_source === "artist_auto" ||
          override.previous_activation_source === "ad_roll" ||
          override.previous_activation_source === "manual"
            ? override.previous_activation_source
            : "manual",
        auto_event_id: null,
        auto_artist_id: null,
      },
      { onConflict: "venue_id" },
    );
  }
  return { ok: true as const };
}
