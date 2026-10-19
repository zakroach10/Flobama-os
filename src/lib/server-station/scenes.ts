import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getPublicSupabaseEnv } from "@/lib/env";
import { isMissingServerStationRelation } from "@/lib/auth/server-station";

type Client = SupabaseClient<Database>;

export type ServerStationSceneCard = {
  id: string;
  title: string;
  kind: string;
  media_kind: string | null;
  public_url: string | null;
  /** Menu thumbnail — PNG poster for video loops, image URL otherwise. */
  preview_url: string | null;
  poster_url: string | null;
  obs_scene_name: string | null;
  artist_id: string | null;
  server_approved: boolean;
};

export type ServerStationPlaylistCard = {
  id: string;
  name: string;
};

/** Build a public preview URL from storage when `public_url` was never persisted. */
export function resolveLedScenePreviewUrl(scene: {
  public_url: string | null | undefined;
  storage_path: string | null | undefined;
}): string | null {
  const path = scene.storage_path?.trim();
  const env = getPublicSupabaseEnv();

  // Prefer a reconstructed public storage URL so previews stay consistent even when
  // older rows have blank/stale public_url values.
  if (path && env?.url) {
    const base = env.url.replace(/\/$/, "");
    const cleaned = path
      .replace(/^\//, "")
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    return `${base}/storage/v1/object/public/screen-ads/${cleaned}`;
  }

  const direct = scene.public_url?.trim();
  return direct || null;
}

/** Menu tiles must use a PNG for video loops — never the MP4 itself. */
export function resolveLedSceneMenuPreviewUrl(scene: {
  media_kind: string | null | undefined;
  public_url: string | null | undefined;
  storage_path: string | null | undefined;
  poster_url: string | null | undefined;
  poster_storage_path: string | null | undefined;
}): string | null {
  if (scene.media_kind === "video") {
    return resolveLedScenePreviewUrl({
      public_url: scene.poster_url,
      storage_path: scene.poster_storage_path,
    });
  }
  return resolveLedScenePreviewUrl(scene);
}

/** Artist scenes are always available on Server Station; house scenes need server_approved. */
export function isServerStationActivatableScene(scene: {
  enabled: boolean;
  kind: string;
  server_approved: boolean;
  artist_id: string | null;
}) {
  if (!scene.enabled) return false;
  if (scene.kind === "trivia" || scene.kind === "audience") return false;
  if (scene.artist_id) return true;
  return scene.server_approved;
}

/** POS-style wall grid: 20 preview tiles per screen, no scrolling. */
export const SERVER_STATION_SCENE_PAGE_SIZE = 20;

export function paginateServerStationScenes<T>(
  scenes: T[],
  page: number,
  pageSize = SERVER_STATION_SCENE_PAGE_SIZE,
) {
  const total = scenes.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * pageSize;
  return {
    page: safePage,
    pageCount,
    pageSize,
    total,
    items: scenes.slice(start, start + pageSize),
    hasPrev: safePage > 1,
    hasNext: safePage < pageCount,
  };
}

function toSceneCard(scene: {
  id: string;
  title: string;
  kind: string;
  media_kind: string | null;
  public_url: string | null;
  storage_path: string | null;
  poster_url: string | null;
  poster_storage_path: string | null;
  obs_scene_name: string | null;
  artist_id: string | null;
  server_approved: boolean;
}): ServerStationSceneCard {
  return {
    id: scene.id,
    title: scene.title,
    kind: scene.kind,
    media_kind: scene.media_kind,
    public_url: scene.public_url,
    poster_url: scene.poster_url,
    preview_url: resolveLedSceneMenuPreviewUrl(scene),
    obs_scene_name: scene.obs_scene_name,
    artist_id: scene.artist_id,
    server_approved: scene.server_approved,
  };
}

export async function listServerApprovedScenes(client: Client, venueId: string) {
  const { data: scenes, error } = await client
    .from("led_wall_scenes")
    .select(
      "id, title, kind, media_kind, public_url, storage_path, poster_url, poster_storage_path, obs_scene_name, artist_id, server_approved, enabled",
    )
    .eq("venue_id", venueId)
    .eq("enabled", true)
    .order("title", { ascending: true });

  if (error) {
    return {
      scenes: [] as ServerStationSceneCard[],
      artistScenes: [] as ServerStationSceneCard[],
      houseScenes: [] as ServerStationSceneCard[],
      playlists: [] as ServerStationPlaylistCard[],
      defaultPlaylistId: null as string | null,
      error: isMissingServerStationRelation(error.message)
        ? "Server Station LED tables are missing. Ask an admin to apply the latest migration."
        : error.message,
    };
  }

  const [{ data: settings }, { data: playlists }] = await Promise.all([
    client
      .from("led_wall_settings")
      .select("default_playlist_id")
      .eq("venue_id", venueId)
      .maybeSingle(),
    client
      .from("led_wall_playlists")
      .select("id, name")
      .eq("venue_id", venueId)
      .is("archived_at", null)
      .order("name", { ascending: true }),
  ]);

  const activatable = (scenes ?? [])
    .filter((scene) =>
      isServerStationActivatableScene({
        enabled: scene.enabled,
        kind: scene.kind,
        server_approved: scene.server_approved,
        artist_id: scene.artist_id,
      }),
    )
    .map(toSceneCard);

  const artistScenes = activatable.filter((scene) => Boolean(scene.artist_id));
  const houseScenes = activatable.filter((scene) => !scene.artist_id);

  return {
    scenes: activatable,
    artistScenes,
    houseScenes,
    playlists: (playlists ?? []).map((playlist) => ({
      id: playlist.id,
      name: playlist.name,
    })),
    defaultPlaylistId: settings?.default_playlist_id ?? null,
    error: null as string | null,
  };
}
