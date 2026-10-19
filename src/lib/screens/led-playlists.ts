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
  poster_url: string | null;
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

/** Next media asset after `fromIndex`, skipping OBS slots so the wall can preload it. */
export function nextLedPlaylistMediaItem(items: PublicLedPlaylistItem[], fromIndex: number) {
  if (items.length <= 1) return null;
  const start = ((fromIndex % items.length) + items.length) % items.length;
  const currentId = items[start]?.id;
  for (let step = 1; step < items.length; step += 1) {
    const item = items[(start + step) % items.length];
    if (!item || item.id === currentId) continue;
    if (item.kind === "media" && item.url && (item.mediaKind === "image" || item.mediaKind === "video")) {
      return item;
    }
  }
  return null;
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

export type LedPlaylistClockItem = { id: string; durationSeconds: number };

function ledPlaylistCycleSeconds(items: Array<{ durationSeconds: number }>) {
  return items.reduce((sum, item) => sum + Math.max(1, item.durationSeconds), 0);
}

/** Where the roll is inside the current ad: index, seconds already shown, seconds left. */
export function ledPlaylistPosition(
  items: LedPlaylistClockItem[],
  startedAt: string | null,
  now = Date.now(),
) {
  if (items.length === 0) return { index: 0, elapsedSeconds: 0, remainingSeconds: 0 };
  const index = ledPlaylistIndexAt(items, startedAt, now);
  const startMs = startedAt ? Date.parse(startedAt) : now;
  const cycleSeconds = ledPlaylistCycleSeconds(items);
  let elapsed = 0;
  if (cycleSeconds > 0 && Number.isFinite(startMs)) {
    elapsed = Math.max(0, (now - startMs) / 1000) % cycleSeconds;
  }
  for (let cursor = 0; cursor < index; cursor += 1) {
    elapsed -= Math.max(1, items[cursor].durationSeconds);
  }
  const duration = Math.max(1, items[index]?.durationSeconds ?? 1);
  const elapsedSeconds = Math.min(duration, Math.max(0, elapsed));
  return {
    index,
    elapsedSeconds,
    remainingSeconds: Math.max(0, duration - elapsedSeconds),
  };
}

/** startedAt that lands on `index` with `elapsedSeconds` already consumed at `now`. */
export function rebaseLedPlaylistStartedAt(
  items: Array<{ durationSeconds: number }>,
  index: number,
  elapsedSeconds: number,
  now = Date.now(),
) {
  if (items.length === 0) return new Date(now).toISOString();
  const safeIndex = ((index % items.length) + items.length) % items.length;
  let prefix = 0;
  for (let cursor = 0; cursor < safeIndex; cursor += 1) {
    prefix += Math.max(1, items[cursor].durationSeconds);
  }
  const duration = Math.max(1, items[safeIndex].durationSeconds);
  const elapsed = Math.min(Math.max(0, elapsedSeconds), Math.max(0, duration - 0.05));
  return new Date(now - (prefix + elapsed) * 1000).toISOString();
}

export function ledPlaylistMembershipEqual(
  left: LedPlaylistClockItem[],
  right: LedPlaylistClockItem[],
) {
  if (left.length !== right.length) return false;
  return left.every(
    (item, index) => item.id === right[index]?.id && item.durationSeconds === right[index]?.durationSeconds,
  );
}

/**
 * Clock for the edited roll. The ad on screen keeps its remaining time.
 * If that ad was removed, the following ad starts from the beginning.
 */
export function cursorAfterPlaylistEdit(
  previous: LedPlaylistClockItem[],
  previousStartedAt: string | null,
  next: LedPlaylistClockItem[],
  now = Date.now(),
) {
  if (next.length === 0) return null;
  const preserved = preserveLedPlaylistStartedAt(previous, previousStartedAt, next, now);
  if (preserved) return preserved;
  if (previous.length === 0) return rebaseLedPlaylistStartedAt(next, 0, 0, now);
  const position = ledPlaylistPosition(previous, previousStartedAt, now);
  for (let step = 1; step <= previous.length; step += 1) {
    const candidate = previous[(position.index + step) % previous.length];
    const nextIndex = next.findIndex((item) => item.id === candidate?.id);
    if (nextIndex >= 0) return rebaseLedPlaylistStartedAt(next, nextIndex, 0, now);
  }
  return rebaseLedPlaylistStartedAt(next, 0, 0, now);
}

/**
 * Keep the ad already on screen when slides are added or removed.
 * Returns null when that ad is no longer in the roll.
 */
export function preserveLedPlaylistStartedAt(
  previous: LedPlaylistClockItem[],
  previousStartedAt: string | null,
  next: LedPlaylistClockItem[],
  now = Date.now(),
) {
  if (previous.length === 0 || next.length === 0) return null;
  const position = ledPlaylistPosition(previous, previousStartedAt, now);
  const currentId = previous[position.index]?.id;
  if (!currentId) return null;
  const nextIndex = next.findIndex((item) => item.id === currentId);
  if (nextIndex < 0) return null;
  return rebaseLedPlaylistStartedAt(next, nextIndex, position.elapsedSeconds, now);
}

function isFreshPlaylistStart(startedAt: string, now: number) {
  const startedMs = Date.parse(startedAt);
  if (!Number.isFinite(startedMs)) return false;
  const age = now - startedMs;
  return age >= -2000 && age < 5000;
}

/**
 * Playlist polls must not jump to a different ad when a server slide joins or leaves.
 * A brand-new activation (startedAt just set to now) still restarts the roll.
 */
export function resolveLedPlaylistStartedAt(
  previous: LedPlaylistClockItem[],
  previousStartedAt: string | null,
  next: LedPlaylistClockItem[],
  nextStartedAt: string | null,
  now = Date.now(),
) {
  if (next.length === 0) return nextStartedAt;
  if (previous.length === 0 || !previousStartedAt) return nextStartedAt;
  if (
    nextStartedAt &&
    nextStartedAt !== previousStartedAt &&
    isFreshPlaylistStart(nextStartedAt, now)
  ) {
    return nextStartedAt;
  }
  if (ledPlaylistMembershipEqual(previous, next)) {
    const local = ledPlaylistPosition(previous, previousStartedAt, now);
    const localId = previous[local.index]?.id;
    const serverIndex = nextStartedAt ? ledPlaylistIndexAt(next, nextStartedAt, now) : local.index;
    const serverId = next[serverIndex]?.id;
    if (localId && serverId && localId !== serverId && local.remainingSeconds > 0.25) {
      return previousStartedAt;
    }
    if (localId && localId === serverId) return previousStartedAt;
    return nextStartedAt ?? previousStartedAt;
  }
  return preserveLedPlaylistStartedAt(previous, previousStartedAt, next, now) ?? nextStartedAt;
}

/** Put a new slide directly after whichever ad is on screen, so it plays next. */
export function insertionAfterCurrentAd(
  items: Array<{ id: string; sortOrder: number; durationSeconds: number }>,
  startedAt: string | null,
  now = Date.now(),
) {
  if (items.length === 0) return { sortOrder: 0, shiftAfterSortOrder: null as number | null };
  const ordered = [...items].sort((left, right) => left.sortOrder - right.sortOrder);
  const position = ledPlaylistPosition(
    ordered.map((item) => ({ id: item.id, durationSeconds: item.durationSeconds })),
    startedAt,
    now,
  );
  const current = ordered[position.index];
  if (!current || position.index >= ordered.length - 1) {
    const maxSort = ordered.reduce((max, item) => Math.max(max, item.sortOrder), -1);
    return { sortOrder: maxSort + 1, shiftAfterSortOrder: null as number | null };
  }
  return { sortOrder: current.sortOrder + 1, shiftAfterSortOrder: current.sortOrder };
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
