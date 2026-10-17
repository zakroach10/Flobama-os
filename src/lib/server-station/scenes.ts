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
  preview_url: string | null;
  obs_scene_name: string | null;
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
  const direct = scene.public_url?.trim();
  if (direct) return direct;

  const path = scene.storage_path?.trim();
  if (!path) return null;

  const env = getPublicSupabaseEnv();
  if (!env?.url) return null;

  const base = env.url.replace(/\/$/, "");
  const cleaned = path.replace(/^\//, "");
  return `${base}/storage/v1/object/public/screen-ads/${cleaned}`;
}

export async function listServerApprovedScenes(client: Client, venueId: string) {
  const { data: scenes, error } = await client
    .from("led_wall_scenes")
    .select(
      "id, title, kind, media_kind, public_url, storage_path, obs_scene_name, server_approved, enabled",
    )
    .eq("venue_id", venueId)
    .eq("enabled", true)
    .eq("server_approved", true)
    .order("sort_order", { ascending: true });

  if (error) {
    return {
      scenes: [] as ServerStationSceneCard[],
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

  return {
    scenes: (scenes ?? []).map((scene) => ({
      id: scene.id,
      title: scene.title,
      kind: scene.kind,
      media_kind: scene.media_kind,
      public_url: scene.public_url,
      preview_url: resolveLedScenePreviewUrl(scene),
      obs_scene_name: scene.obs_scene_name,
    })),
    playlists: (playlists ?? []).map((playlist) => ({
      id: playlist.id,
      name: playlist.name,
    })),
    defaultPlaylistId: settings?.default_playlist_id ?? null,
    error: null as string | null,
  };
}
