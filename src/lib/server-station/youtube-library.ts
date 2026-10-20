import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { isMissingServerStationRelation } from "@/lib/auth/server-station";
import { parseYoutubeVideoUrl } from "@/lib/screens/youtube";

type Client = SupabaseClient<Database>;

export type ServerStationYoutubeVideo = {
  id: string;
  videoId: string;
  watchUrl: string;
  title: string;
  thumbnailUrl: string | null;
  isFavorite: boolean;
  playCount: number;
  lastPlayedAt: string | null;
  favoritedAt: string | null;
};

function mapRow(row: {
  id: string;
  video_id: string;
  watch_url: string;
  title: string;
  thumbnail_url: string | null;
  is_favorite: boolean;
  play_count: number;
  last_played_at: string | null;
  favorited_at: string | null;
}): ServerStationYoutubeVideo {
  return {
    id: row.id,
    videoId: row.video_id,
    watchUrl: row.watch_url,
    title: row.title,
    thumbnailUrl: row.thumbnail_url,
    isFavorite: row.is_favorite,
    playCount: row.play_count,
    lastPlayedAt: row.last_played_at,
    favoritedAt: row.favorited_at,
  };
}

export function youtubeThumbnailUrl(videoId: string) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export async function recordYoutubePlay(
  client: Client,
  input: {
    venueId: string;
    watchUrl: string;
    title?: string | null;
    actorUserId?: string | null;
    actorName?: string | null;
    now?: Date;
  },
) {
  const parsed = parseYoutubeVideoUrl(input.watchUrl);
  if (!parsed) return { ok: false as const, message: "Invalid YouTube link.", video: null };

  const now = (input.now ?? new Date()).toISOString();
  const title = (input.title?.trim() || parsed.title).slice(0, 160);
  const thumbnailUrl = youtubeThumbnailUrl(parsed.videoId);

  const { data: existing } = await client
    .from("server_station_youtube_videos")
    .select("id, play_count, is_favorite")
    .eq("venue_id", input.venueId)
    .eq("video_id", parsed.videoId)
    .maybeSingle();

  if (existing) {
    const { data, error } = await client
      .from("server_station_youtube_videos")
      .update({
        watch_url: parsed.watchUrl,
        title,
        thumbnail_url: thumbnailUrl,
        play_count: (existing.play_count ?? 0) + 1,
        last_played_at: now,
      })
      .eq("id", existing.id)
      .select(
        "id, video_id, watch_url, title, thumbnail_url, is_favorite, play_count, last_played_at, favorited_at",
      )
      .maybeSingle();
    if (error) {
      return {
        ok: false as const,
        message: isMissingServerStationRelation(error.message)
          ? "YouTube library tables are missing."
          : error.message,
        video: null,
      };
    }
    return { ok: true as const, message: "Recorded.", video: data ? mapRow(data) : null };
  }

  const { data, error } = await client
    .from("server_station_youtube_videos")
    .insert({
      venue_id: input.venueId,
      video_id: parsed.videoId,
      watch_url: parsed.watchUrl,
      title,
      thumbnail_url: thumbnailUrl,
      is_favorite: false,
      play_count: 1,
      last_played_at: now,
      created_by: input.actorUserId ?? null,
      created_by_name: input.actorName ?? null,
    })
    .select(
      "id, video_id, watch_url, title, thumbnail_url, is_favorite, play_count, last_played_at, favorited_at",
    )
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      message: isMissingServerStationRelation(error.message)
        ? "YouTube library tables are missing."
        : error.message,
      video: null,
    };
  }
  return { ok: true as const, message: "Recorded.", video: data ? mapRow(data) : null };
}

export async function listYoutubeLibrary(client: Client, venueId: string, limit = 24) {
  const { data, error } = await client
    .from("server_station_youtube_videos")
    .select(
      "id, video_id, watch_url, title, thumbnail_url, is_favorite, play_count, last_played_at, favorited_at",
    )
    .eq("venue_id", venueId)
    .order("last_played_at", { ascending: false, nullsFirst: false })
    .limit(Math.max(limit * 2, 48));

  if (error) {
    return {
      recent: [] as ServerStationYoutubeVideo[],
      favorites: [] as ServerStationYoutubeVideo[],
      missingTable: isMissingServerStationRelation(error.message),
      error: isMissingServerStationRelation(error.message) ? null : error.message,
    };
  }

  const rows = (data ?? []).map(mapRow);
  const favorites = rows
    .filter((row) => row.isFavorite)
    .sort((a, b) => Date.parse(b.favoritedAt ?? "") - Date.parse(a.favoritedAt ?? ""))
    .slice(0, limit);
  const recent = rows.filter((row) => row.lastPlayedAt).slice(0, limit);
  return { recent, favorites, missingTable: false, error: null };
}

export async function setYoutubeFavorite(
  client: Client,
  input: {
    venueId: string;
    videoId: string;
    favorite: boolean;
    watchUrl?: string;
    title?: string | null;
    actorUserId?: string | null;
    actorName?: string | null;
  },
) {
  const now = new Date().toISOString();
  const { data: existing } = await client
    .from("server_station_youtube_videos")
    .select("id")
    .eq("venue_id", input.venueId)
    .eq("video_id", input.videoId)
    .maybeSingle();

  if (!existing) {
    const parsed = input.watchUrl ? parseYoutubeVideoUrl(input.watchUrl) : null;
    if (!parsed || parsed.videoId !== input.videoId) {
      return { ok: false as const, message: "Play this video once before favoriting, or pass a valid link." };
    }
    const { error } = await client.from("server_station_youtube_videos").insert({
      venue_id: input.venueId,
      video_id: parsed.videoId,
      watch_url: parsed.watchUrl,
      title: (input.title?.trim() || parsed.title).slice(0, 160),
      thumbnail_url: youtubeThumbnailUrl(parsed.videoId),
      is_favorite: input.favorite,
      favorited_at: input.favorite ? now : null,
      play_count: 0,
      created_by: input.actorUserId ?? null,
      created_by_name: input.actorName ?? null,
    });
    if (error) {
      return {
        ok: false as const,
        message: isMissingServerStationRelation(error.message)
          ? "YouTube library tables are missing."
          : error.message,
      };
    }
    return { ok: true as const, message: input.favorite ? "Saved to favorites." : "Removed from favorites." };
  }

  const { error } = await client
    .from("server_station_youtube_videos")
    .update({
      is_favorite: input.favorite,
      favorited_at: input.favorite ? now : null,
    })
    .eq("id", existing.id)
    .eq("venue_id", input.venueId);

  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const, message: input.favorite ? "Saved to favorites." : "Removed from favorites." };
}
