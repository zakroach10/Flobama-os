import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { FLO_BAMA_VENUE_ID, MENU_SPECIAL_CATEGORY_LABELS, WEEK_EVENTS_PUBLIC_URL } from "@/lib/constants";
import { toPublicPlaylist, type PublicScreenAd, type StaffScreenAd } from "@/lib/screens/playlist";
import {
  isMissingScreenPlaylistRelation,
  resolvePlaylistItemToPublic,
  type StaffMenuSpecial,
  type StaffPlaylistItem,
  type StaffScreenPlaylist,
} from "@/lib/screens/playlists";

type Client = SupabaseClient<Database>;

export async function listStaffPlaylists(client: Client, venueId: string) {
  const { data, error } = await client
    .from("screen_playlists")
    .select("id, name, is_active, archived_at")
    .eq("venue_id", venueId)
    .is("archived_at", null)
    .order("is_active", { ascending: false })
    .order("name", { ascending: true });
  if (error) {
    return {
      playlists: [] as StaffScreenPlaylist[],
      missingTable: isMissingScreenPlaylistRelation(error.message),
      error: isMissingScreenPlaylistRelation(error.message) ? null : error.message,
    };
  }
  return { playlists: (data ?? []) as StaffScreenPlaylist[], missingTable: false, error: null };
}

export async function listStaffMenuSpecials(client: Client, venueId: string) {
  const { data, error } = await client
    .from("menu_specials")
    .select(
      "id, title, subtitle, category, price_label, public_url, media_kind, duration_seconds, starts_at, ends_at, enabled, archived_at",
    )
    .eq("venue_id", venueId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error) {
    return {
      specials: [] as StaffMenuSpecial[],
      missingTable: isMissingScreenPlaylistRelation(error.message),
      error: isMissingScreenPlaylistRelation(error.message) ? null : error.message,
    };
  }
  return { specials: (data ?? []) as StaffMenuSpecial[], missingTable: false, error: null };
}

export async function listStaffPlaylistItems(client: Client, venueId: string, playlistId: string) {
  const { data, error } = await client
    .from("screen_playlist_items")
    .select(
      "id, playlist_id, source_kind, media_id, special_id, duration_seconds, transition, sort_order, enabled, archived_at",
    )
    .eq("venue_id", venueId)
    .eq("playlist_id", playlistId)
    .is("archived_at", null)
    .order("sort_order", { ascending: true });
  if (error) {
    return {
      items: [] as StaffPlaylistItem[],
      missingTable: isMissingScreenPlaylistRelation(error.message),
      error: isMissingScreenPlaylistRelation(error.message) ? null : error.message,
    };
  }

  const rows = data ?? [];
  const mediaIds = rows.map((row) => row.media_id).filter((id): id is string => Boolean(id));
  const specialIds = rows.map((row) => row.special_id).filter((id): id is string => Boolean(id));

  const [{ data: mediaRows }, { data: specialRows }] = await Promise.all([
    mediaIds.length
      ? client
          .from("screen_ads")
          .select("id, title, public_url, media_kind, duration_seconds, transition, enabled, archived_at")
          .in("id", mediaIds)
      : Promise.resolve({ data: [] as Array<Pick<StaffScreenAd, "id" | "title" | "public_url" | "media_kind" | "duration_seconds" | "transition" | "enabled" | "archived_at">> }),
    specialIds.length
      ? client
          .from("menu_specials")
          .select(
            "id, title, subtitle, category, price_label, public_url, media_kind, duration_seconds, starts_at, ends_at, enabled, archived_at",
          )
          .in("id", specialIds)
      : Promise.resolve({ data: [] as StaffMenuSpecial[] }),
  ]);

  const mediaById = new Map((mediaRows ?? []).map((row) => [row.id, row]));
  const specialById = new Map((specialRows ?? []).map((row) => [row.id, row as StaffMenuSpecial]));

  const items: StaffPlaylistItem[] = rows.map((row) => {
    if (row.source_kind === "week_events") {
      return {
        id: row.id,
        playlist_id: row.playlist_id,
        source_kind: "week_events",
        media_id: null,
        special_id: null,
        duration_seconds: row.duration_seconds,
        transition: row.transition,
        sort_order: row.sort_order,
        enabled: row.enabled,
        archived_at: row.archived_at,
        title: "This week's events",
        public_url: WEEK_EVENTS_PUBLIC_URL,
        media_kind: "week_events",
        preview_label: "This week",
      };
    }
    if (row.source_kind === "special") {
      const special = row.special_id ? specialById.get(row.special_id) : null;
      return {
        id: row.id,
        playlist_id: row.playlist_id,
        source_kind: "special",
        media_id: null,
        special_id: row.special_id,
        duration_seconds: row.duration_seconds ?? special?.duration_seconds ?? 12,
        transition: row.transition,
        sort_order: row.sort_order,
        enabled: row.enabled,
        archived_at: row.archived_at,
        title: special?.title ?? "Special",
        public_url: special?.public_url ?? "",
        media_kind: special?.media_kind ?? "image",
        preview_label: special ? MENU_SPECIAL_CATEGORY_LABELS[special.category] : "Special",
      };
    }
    const media = row.media_id ? mediaById.get(row.media_id) : null;
    return {
      id: row.id,
      playlist_id: row.playlist_id,
      source_kind: "media",
      media_id: row.media_id,
      special_id: null,
      duration_seconds: row.duration_seconds ?? media?.duration_seconds ?? null,
      transition: row.transition,
      sort_order: row.sort_order,
      enabled: row.enabled,
      archived_at: row.archived_at,
      title: media?.title ?? "Media",
      public_url: media?.public_url ?? "",
      media_kind: media?.media_kind ?? "image",
      preview_label: media?.media_kind === "video" ? "Video" : "Media",
    };
  });

  return { items, missingTable: false, error: null };
}

export async function listPublicVerticalAds(
  client: Client,
  venueId = FLO_BAMA_VENUE_ID,
): Promise<{ ads: PublicScreenAd[]; error: string | null; usedPlaylists: boolean }> {
  const playlistRes = await client
    .from("screen_active_playlist_listings")
    .select("*")
    .eq("venue_id", venueId)
    .order("sort_order", { ascending: true });

  if (!playlistRes.error) {
    return {
      ads: (playlistRes.data ?? []).map((row) =>
        resolvePlaylistItemToPublic({
          id: row.id,
          title: row.title,
          public_url: row.public_url,
          media_kind: row.media_kind,
          duration_seconds: row.duration_seconds,
          transition: row.transition,
        }),
      ),
      error: null,
      usedPlaylists: true,
    };
  }

  if (!isMissingScreenPlaylistRelation(playlistRes.error.message)) {
    return { ads: [], error: playlistRes.error.message, usedPlaylists: false };
  }

  const { data, error } = await client
    .from("screen_ad_listings")
    .select("*")
    .eq("venue_id", venueId)
    .order("sort_order", { ascending: true });
  if (error) return { ads: [], error: error.message, usedPlaylists: false };
  const ads = toPublicPlaylist(
    (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      public_url: row.public_url,
      media_kind: row.media_kind,
      duration_seconds: row.duration_seconds,
      transition: row.transition,
      sort_order: row.sort_order,
      enabled: true,
      archived_at: null,
    })),
  );
  return { ads, error: null, usedPlaylists: false };
}
