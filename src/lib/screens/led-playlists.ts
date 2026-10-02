import { LED_WALL_PLAYLISTS_SQL } from "@/lib/constants";
import type { LedWallMediaKind, LedWallSceneKind, PublicLedMedia } from "@/lib/screens/led-wall";

export { LED_WALL_PLAYLISTS_SQL };

export type StaffLedPlaylist = {
  id: string;
  name: string;
  archived_at: string | null;
};

export type StaffLedPlaylistItem = {
  id: string;
  playlist_id: string;
  scene_id: string;
  duration_seconds: number;
  sort_order: number;
  enabled: boolean;
  archived_at: string | null;
  title: string;
  kind: LedWallSceneKind;
  media_kind: LedWallMediaKind | "week_events" | null;
  public_url: string | null;
  obs_scene_name: string | null;
};

export type PublicLedPlaylistItem = {
  id: string;
  sceneId: string;
  title: string;
  kind: LedWallSceneKind;
  mediaKind: LedWallMediaKind | null;
  url: string | null;
  obsSceneName: string | null;
  durationSeconds: number;
};

export type PublicLedPlayback = {
  mode: "idle" | "scene" | "playlist";
  active: PublicLedMedia | null;
  playlist: PublicLedPlaylistItem[];
  playlistId: string | null;
  startedAt: string | null;
  revision: string;
};

export function isMissingLedPlaylistRelation(message: string | null | undefined) {
  return /led_wall_playlist/i.test(message ?? "") && /does not exist|schema cache|could not find/i.test(message ?? "");
}

export function holdMsForLedPlaylistItem(item: Pick<PublicLedPlaylistItem, "kind" | "mediaKind" | "durationSeconds">) {
  if (item.kind === "media" && item.mediaKind === "video") return 0;
  return Math.max(1, item.durationSeconds) * 1000;
}

export function nextLedPlaylistIndex(index: number, length: number) {
  if (length <= 0) return 0;
  return (index + 1) % length;
}

/** Avoid resetting hold timers when the poll returns the same playlist content. */
export function ledPlaylistsEqual(left: PublicLedPlaylistItem[], right: PublicLedPlaylistItem[]) {
  if (left.length !== right.length) return false;
  return left.every(
    (item, index) =>
      item.id === right[index]?.id &&
      item.sceneId === right[index]?.sceneId &&
      item.kind === right[index]?.kind &&
      item.mediaKind === right[index]?.mediaKind &&
      item.url === right[index]?.url &&
      item.obsSceneName === right[index]?.obsSceneName &&
      item.durationSeconds === right[index]?.durationSeconds,
  );
}

/** Time-based cursor so display + OBS agent pick the same slot. */
export function ledPlaylistIndexAt(items: Array<{ durationSeconds: number }>, startedAt: string | null, now = Date.now()) {
  if (items.length === 0) return 0;
  const startMs = startedAt ? Date.parse(startedAt) : now;
  if (!Number.isFinite(startMs)) return 0;
  const cycleSeconds = items.reduce((sum, item) => sum + Math.max(1, item.durationSeconds), 0);
  if (cycleSeconds <= 0) return 0;
  let elapsed = Math.max(0, (now - startMs) / 1000) % cycleSeconds;
  for (let index = 0; index < items.length; index += 1) {
    elapsed -= Math.max(1, items[index].durationSeconds);
    if (elapsed < 0) return index;
  }
  return 0;
}

export function playlistRevision(items: PublicLedPlaylistItem[], startedAt: string | null, playlistId: string | null) {
  return [
    playlistId ?? "",
    startedAt ?? "",
    ...items.map((item) =>
      [item.id, item.sceneId, item.kind, item.mediaKind ?? "", item.url ?? "", item.durationSeconds].join(":"),
    ),
  ].join("|");
}

export function toPublicLedPlaylistItem(row: {
  id: string;
  scene_id: string;
  title: string;
  kind: string;
  media_kind: string | null;
  public_url: string | null;
  obs_scene_name: string | null;
  duration_seconds: number;
}): PublicLedPlaylistItem {
  const mediaKind = row.media_kind === "image" || row.media_kind === "video" ? row.media_kind : null;
  return {
    id: row.id,
    sceneId: row.scene_id,
    title: row.title,
    kind: row.kind as LedWallSceneKind,
    mediaKind,
    url: row.public_url,
    obsSceneName: row.obs_scene_name,
    durationSeconds: row.duration_seconds,
  };
}

export function mediaFromPlaylistItem(item: PublicLedPlaylistItem): PublicLedMedia | null {
  if (item.kind !== "media" || !item.url || !item.mediaKind) return null;
  return { id: item.sceneId, title: item.title, url: item.url, mediaKind: item.mediaKind };
}
