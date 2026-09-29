import {
  MENU_SPECIAL_CATEGORY_LABELS,
  WEEK_EVENTS_PUBLIC_URL,
  type MenuSpecialCategory,
  type ScreenMediaKind,
  type ScreenTransition,
} from "@/lib/constants";
import { isWeekEventsUrl, type PublicScreenAd, type StaffScreenAd } from "@/lib/screens/playlist";

export const PLAYLIST_ITEM_SOURCES = ["media", "special", "week_events"] as const;
export type PlaylistItemSource = (typeof PLAYLIST_ITEM_SOURCES)[number];
export type { MenuSpecialCategory };

export type StaffMenuSpecial = {
  id: string;
  title: string;
  subtitle: string | null;
  category: MenuSpecialCategory;
  price_label: string | null;
  public_url: string;
  media_kind: Extract<ScreenMediaKind, "image" | "video">;
  duration_seconds: number;
  starts_at: string | null;
  ends_at: string | null;
  enabled: boolean;
  archived_at: string | null;
};

export type StaffScreenPlaylist = {
  id: string;
  name: string;
  is_active: boolean;
  archived_at: string | null;
};

export type StaffPlaylistItem = {
  id: string;
  playlist_id: string;
  source_kind: PlaylistItemSource;
  media_id: string | null;
  special_id: string | null;
  duration_seconds: number | null;
  transition: ScreenTransition;
  sort_order: number;
  enabled: boolean;
  archived_at: string | null;
  title: string;
  public_url: string;
  media_kind: ScreenMediaKind;
  preview_label: string;
};

export function isMissingScreenPlaylistRelation(message: string | null | undefined) {
  if (!message) return false;
  return /screen_playlists|screen_playlist_items|menu_specials|screen_active_playlist_listings|menu_special_category|screen_playlist_item_source/i.test(
    message,
  );
}

export function specialIsLive(
  special: Pick<StaffMenuSpecial, "enabled" | "archived_at" | "starts_at" | "ends_at">,
  now = new Date(),
) {
  if (!special.enabled || special.archived_at) return false;
  if (special.starts_at && new Date(special.starts_at) > now) return false;
  if (special.ends_at && new Date(special.ends_at) <= now) return false;
  return true;
}

export function resolvePlaylistItemToPublic(input: {
  id: string;
  title: string;
  public_url: string;
  media_kind: ScreenMediaKind | string;
  duration_seconds: number | null;
  transition: ScreenTransition;
}): PublicScreenAd {
  const week = isWeekEventsUrl(input.public_url) || input.media_kind === "week_events";
  return {
    id: input.id,
    title: input.title,
    url: week ? WEEK_EVENTS_PUBLIC_URL : input.public_url,
    mediaKind: week ? "week_events" : (input.media_kind as ScreenMediaKind),
    durationSeconds: input.duration_seconds,
    transition: input.transition,
  };
}

export function staffItemFromMedia(
  playlistId: string,
  itemId: string,
  ad: StaffScreenAd,
  sortOrder: number,
  overrides?: Partial<Pick<StaffPlaylistItem, "duration_seconds" | "transition" | "enabled">>,
): StaffPlaylistItem {
  const week = isWeekEventsUrl(ad.public_url) || ad.media_kind === "week_events";
  return {
    id: itemId,
    playlist_id: playlistId,
    source_kind: week ? "week_events" : "media",
    media_id: week ? null : ad.id,
    special_id: null,
    duration_seconds: overrides?.duration_seconds ?? ad.duration_seconds,
    transition: overrides?.transition ?? ad.transition,
    sort_order: sortOrder,
    enabled: overrides?.enabled ?? ad.enabled,
    archived_at: null,
    title: ad.title,
    public_url: week ? WEEK_EVENTS_PUBLIC_URL : ad.public_url,
    media_kind: week ? "week_events" : ad.media_kind,
    preview_label: week ? "This week" : ad.media_kind === "video" ? "Video" : "Media",
  };
}

export function staffItemFromSpecial(
  playlistId: string,
  itemId: string,
  special: StaffMenuSpecial,
  sortOrder: number,
  overrides?: Partial<Pick<StaffPlaylistItem, "duration_seconds" | "transition" | "enabled">>,
): StaffPlaylistItem {
  return {
    id: itemId,
    playlist_id: playlistId,
    source_kind: "special",
    media_id: null,
    special_id: special.id,
    duration_seconds: overrides?.duration_seconds ?? special.duration_seconds,
    transition: overrides?.transition ?? "fade",
    sort_order: sortOrder,
    enabled: overrides?.enabled ?? true,
    archived_at: null,
    title: special.title,
    public_url: special.public_url,
    media_kind: special.media_kind,
    preview_label: MENU_SPECIAL_CATEGORY_LABELS[special.category],
  };
}
