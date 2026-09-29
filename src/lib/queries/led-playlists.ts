import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { getPublicLedMedia } from "@/lib/queries/led-wall";
import {
  isMissingLedPlaylistRelation,
  ledPlaylistIndexAt,
  mediaFromPlaylistItem,
  playlistRevision,
  toPublicLedPlaylistItem,
  type PublicLedPlayback,
  type StaffLedPlaylist,
  type StaffLedPlaylistItem,
} from "@/lib/screens/led-playlists";
import type { LedSceneRef } from "@/lib/screens/led-wall";

type Client = SupabaseClient<Database>;

export async function listStaffLedPlaylists(client: Client, venueId: string) {
  const { data, error } = await client
    .from("led_wall_playlists")
    .select("id, name, archived_at")
    .eq("venue_id", venueId)
    .is("archived_at", null)
    .order("name", { ascending: true });
  if (error) {
    return {
      playlists: [] as StaffLedPlaylist[],
      missingTable: isMissingLedPlaylistRelation(error.message),
      error: isMissingLedPlaylistRelation(error.message) ? null : error.message,
    };
  }
  return { playlists: (data ?? []) as StaffLedPlaylist[], missingTable: false, error: null };
}

export async function listStaffLedPlaylistItems(client: Client, venueId: string, playlistId: string) {
  const { data, error } = await client
    .from("led_wall_playlist_items")
    .select("id, playlist_id, scene_id, duration_seconds, sort_order, enabled, archived_at")
    .eq("venue_id", venueId)
    .eq("playlist_id", playlistId)
    .is("archived_at", null)
    .order("sort_order", { ascending: true });
  if (error) {
    return {
      items: [] as StaffLedPlaylistItem[],
      missingTable: isMissingLedPlaylistRelation(error.message),
      error: isMissingLedPlaylistRelation(error.message) ? null : error.message,
    };
  }

  const rows = data ?? [];
  const sceneIds = rows.map((row) => row.scene_id);
  const { data: scenes } = sceneIds.length
    ? await client
        .from("led_wall_scenes")
        .select("id, title, kind, media_kind, public_url, obs_scene_name")
        .in("id", sceneIds)
    : { data: [] as Array<{
        id: string;
        title: string;
        kind: StaffLedPlaylistItem["kind"];
        media_kind: StaffLedPlaylistItem["media_kind"];
        public_url: string | null;
        obs_scene_name: string | null;
      }> };

  const byId = new Map((scenes ?? []).map((scene) => [scene.id, scene]));
  const items: StaffLedPlaylistItem[] = rows.map((row) => {
    const scene = byId.get(row.scene_id);
    return {
      id: row.id,
      playlist_id: row.playlist_id,
      scene_id: row.scene_id,
      duration_seconds: row.duration_seconds,
      sort_order: row.sort_order,
      enabled: row.enabled,
      archived_at: row.archived_at,
      title: scene?.title ?? "Scene",
      kind: scene?.kind ?? "media",
      media_kind: scene?.media_kind ?? null,
      public_url: scene?.public_url ?? null,
      obs_scene_name: scene?.obs_scene_name ?? null,
    };
  });
  return { items, missingTable: false, error: null };
}

export async function getPublicLedPlayback(
  client: Client,
  venueId = FLO_BAMA_VENUE_ID,
): Promise<{ playback: PublicLedPlayback; error: string | null }> {
  const { data: runtime, error: runtimeError } = await client
    .from("led_wall_runtime")
    .select("active_scene_id, active_playlist_id, activated_at")
    .eq("venue_id", venueId)
    .maybeSingle();

  if (runtimeError) {
    if (isMissingLedPlaylistRelation(runtimeError.message) || /active_playlist_id/i.test(runtimeError.message)) {
      const { media, error } = await getPublicLedMedia(client, venueId);
      return {
        playback: {
          mode: media ? "scene" : "idle",
          active: media,
          playlist: [],
          playlistId: null,
          startedAt: null,
          revision: media?.id ?? "idle",
        },
        error,
      };
    }
    if (/led_wall_runtime/i.test(runtimeError.message) && /does not exist|schema cache/i.test(runtimeError.message)) {
      return {
        playback: {
          mode: "idle",
          active: null,
          playlist: [],
          playlistId: null,
          startedAt: null,
          revision: "idle",
        },
        error: null,
      };
    }
    return {
      playback: {
        mode: "idle",
        active: null,
        playlist: [],
        playlistId: null,
        startedAt: null,
        revision: "idle",
      },
      error: runtimeError.message,
    };
  }

  if (runtime?.active_playlist_id) {
    const { data, error } = await client
      .from("led_wall_active_playlist_listings")
      .select("*")
      .eq("venue_id", venueId)
      .order("sort_order", { ascending: true });
    if (error) {
      if (isMissingLedPlaylistRelation(error.message)) {
        const { media, error: mediaError } = await getPublicLedMedia(client, venueId);
        return {
          playback: {
            mode: media ? "scene" : "idle",
            active: media,
            playlist: [],
            playlistId: null,
            startedAt: null,
            revision: media?.id ?? "idle",
          },
          error: mediaError,
        };
      }
      return {
        playback: {
          mode: "idle",
          active: null,
          playlist: [],
          playlistId: null,
          startedAt: null,
          revision: "idle",
        },
        error: error.message,
      };
    }
    const playlist = (data ?? []).map((row) =>
      toPublicLedPlaylistItem({
        id: row.id,
        scene_id: row.scene_id,
        title: row.title,
        kind: row.kind,
        media_kind: row.media_kind,
        public_url: row.public_url,
        obs_scene_name: row.obs_scene_name,
        duration_seconds: row.duration_seconds,
      }),
    );
    const index = ledPlaylistIndexAt(playlist, runtime.activated_at);
    const current = playlist[index] ?? null;
    return {
      playback: {
        mode: "playlist",
        active: current ? mediaFromPlaylistItem(current) : null,
        playlist,
        playlistId: runtime.active_playlist_id,
        startedAt: runtime.activated_at,
        revision: playlistRevision(playlist, runtime.activated_at, runtime.active_playlist_id),
      },
      error: null,
    };
  }

  const { media, error } = await getPublicLedMedia(client, venueId);
  return {
    playback: {
      mode: media ? "scene" : "idle",
      active: media,
      playlist: [],
      playlistId: null,
      startedAt: runtime?.activated_at ?? null,
      revision: `${runtime?.active_scene_id ?? "idle"}:${runtime?.activated_at ?? ""}`,
    },
    error,
  };
}

export function resolvePlaylistActiveScene(
  playback: PublicLedPlayback,
): LedSceneRef | null {
  if (playback.mode !== "playlist" || playback.playlist.length === 0) return null;
  const index = ledPlaylistIndexAt(playback.playlist, playback.startedAt);
  const item = playback.playlist[index];
  if (!item) return null;
  return {
    id: item.sceneId,
    kind: item.kind,
    enabled: true,
    obsSceneName: item.obsSceneName,
  };
}
