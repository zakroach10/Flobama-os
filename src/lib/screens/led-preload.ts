import type { PublicLedMedia } from "@/lib/screens/led-wall";

/** Warm today's graphics this long before showtime. Auto-roll still waits until its own window. */
export const LED_PRELOAD_LEAD_MS = 20 * 60 * 1000;

export const LED_PRELOAD_MAX_IMAGES = 6;
export const LED_PRELOAD_MAX_VIDEOS = 2;

/** Hosted-browser reports older than this are ignored. The Local Runner uses a longer window. */
export const LED_PRELOAD_REPORT_FRESH_MS = 45_000;

/** Local Runner status is refreshed on change, with a slow keepalive, not every heartbeat. */
export const LED_PRELOAD_RUNNER_FRESH_MS = 6 * 60 * 1000;

/** Videos larger than this are not pinned into the Local Runner cache ahead of time. */
export const LED_PRELOAD_MAX_VIDEO_BYTES = 80 * 1024 * 1024;

/** Default Local Runner heartbeat. The runner notices a new scene on the next beat. */
export const LOCAL_RUNNER_HEARTBEAT_MS = 2000;

/** Wall player polls the Local Runner's own /api/playback. This does not hit Supabase. */
export const LOCAL_WALL_POLL_MS = 1000;

export type PreloadMediaKind = "image" | "video";

export type PreloadItem = {
  id: string;
  title: string;
  url: string;
  mediaKind: PreloadMediaKind;
  source: "schedule" | "manual" | "playlist";
  startsAt: string | null;
};

export type SchedulePreloadArtist = {
  name: string;
  enabled: boolean;
  sceneId: string | null;
  scenes: Array<{
    sceneId: string;
    title: string;
    publicUrl: string | null;
    mediaKind: string | null;
    enabled: boolean;
  }>;
};

export type SchedulePreloadListing = {
  startsAt: string;
  endsAt: string;
  artists: SchedulePreloadArtist[];
};

function isWarmableKind(kind: string | null | undefined): kind is PreloadMediaKind {
  return kind === "image" || kind === "video";
}

/**
 * Graphics whose show is inside the lead window, or already started and not yet over.
 * Does not include shows that have ended. Does not choose what is on the wall.
 */
export function scheduledPreloadItems(
  listings: SchedulePreloadListing[],
  nowMs: number,
  leadMs = LED_PRELOAD_LEAD_MS,
): PreloadItem[] {
  const items: PreloadItem[] = [];
  const seen = new Set<string>();
  const ordered = [...listings].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  for (const listing of ordered) {
    const start = Date.parse(listing.startsAt);
    const end = Date.parse(listing.endsAt);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (nowMs < start - leadMs || nowMs >= end) continue;
    for (const artist of listing.artists) {
      if (!artist.enabled || !artist.sceneId) continue;
      const scene = artist.scenes.find((row) => row.sceneId === artist.sceneId && row.enabled);
      const url = scene?.publicUrl?.trim() || "";
      if (!scene || !url || !isWarmableKind(scene.mediaKind)) continue;
      if (seen.has(scene.sceneId)) continue;
      seen.add(scene.sceneId);
      items.push({
        id: scene.sceneId,
        title: scene.title || artist.name,
        url,
        mediaKind: scene.mediaKind,
        source: "schedule",
        startsAt: listing.startsAt,
      });
    }
  }
  return items;
}

export function capPreloadItems(
  items: PreloadItem[],
  limits: { maxImages?: number; maxVideos?: number } = {},
): PreloadItem[] {
  const maxImages = limits.maxImages ?? LED_PRELOAD_MAX_IMAGES;
  const maxVideos = limits.maxVideos ?? LED_PRELOAD_MAX_VIDEOS;
  let images = 0;
  let videos = 0;
  const kept: PreloadItem[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (!item.url || seen.has(item.id)) continue;
    if (item.mediaKind === "image") {
      if (images >= maxImages) continue;
      images += 1;
    } else {
      if (videos >= maxVideos) continue;
      videos += 1;
    }
    seen.add(item.id);
    kept.push(item);
  }
  return kept;
}

/** Upcoming playlist slides after the one already on screen, so the next cut is decoded. */
export function playlistPreloadItems(
  playlist: Array<{ sceneId: string; title: string; url: string | null; mediaKind: string | null }>,
  activeIndex: number,
): PreloadItem[] {
  if (playlist.length < 2) return [];
  const next = playlist[(activeIndex + 1) % playlist.length];
  if (!next?.url || !isWarmableKind(next.mediaKind)) return [];
  return [
    {
      id: next.sceneId,
      title: next.title,
      url: next.url,
      mediaKind: next.mediaKind,
      source: "playlist",
      startsAt: null,
    },
  ];
}

export function mergePreloadItems(input: {
  scheduled: PreloadItem[];
  manual: PreloadItem[];
  playlist?: PreloadItem[];
  /** URL currently on the wall. Still decoded by being visible; do not also hide-load it. */
  activeUrl?: string | null;
}): PreloadItem[] {
  const active = input.activeUrl?.trim() || "";
  const merged = [...input.scheduled, ...input.manual, ...(input.playlist ?? [])].filter(
    (item) => item.url.trim() !== active,
  );
  return capPreloadItems(merged);
}

export type PreloadReportState = "loading" | "ready" | "error";

export function summarizePreloadReports(
  reports: Array<{ sceneId: string; state: PreloadReportState; updatedAtMs: number; message?: string | null }>,
  nowMs: number,
  freshMs = LED_PRELOAD_REPORT_FRESH_MS,
): Map<string, { state: PreloadReportState; message: string | null }> {
  const rank: Record<PreloadReportState, number> = { ready: 3, loading: 2, error: 1 };
  const best = new Map<string, { state: PreloadReportState; message: string | null; rank: number }>();
  for (const report of reports) {
    if (nowMs - report.updatedAtMs > freshMs) continue;
    const current = best.get(report.sceneId);
    const score = rank[report.state];
    if (!current || score > current.rank) {
      best.set(report.sceneId, {
        state: report.state,
        message: report.message?.trim() || null,
        rank: score,
      });
    }
  }
  const summary = new Map<string, { state: PreloadReportState; message: string | null }>();
  for (const [sceneId, value] of best) {
    summary.set(sceneId, { state: value.state, message: value.message });
  }
  return summary;
}

/**
 * Command-to-visible model for the hosted LED page.
 * Cold: the renderer learns the new scene on its next poll, then fetches and decodes.
 * Warm: the file is already decoded in that browser, so only the poll remains.
 * This is not a measurement from the venue OBS machine.
 */
export function commandToVisibleMs(input: {
  pollMs: number;
  decodeMs: number;
  warmed: boolean;
}): { ms: number; waitsForDecode: boolean } {
  const pollMs = Math.max(0, input.pollMs);
  const decodeMs = Math.max(0, input.decodeMs);
  if (input.warmed) return { ms: pollMs, waitsForDecode: false };
  return { ms: pollMs + decodeMs, waitsForDecode: true };
}

/** Keep the current picture until the next URL is decoded. Never blank a good frame for a slow load. */
export function visibleWhileLoading<T extends { url: string }>(input: {
  requested: T | null;
  showing: T | null;
  readyUrls: ReadonlySet<string>;
}): T | null {
  if (!input.requested) return null;
  if (input.readyUrls.has(input.requested.url) || input.showing?.url === input.requested.url) {
    return input.requested;
  }
  return input.showing;
}

export function runnerPreloadClientKey(deviceId: string) {
  return `runner:${deviceId}`;
}

export function isRunnerPreloadClient(clientKey: string | null | undefined) {
  return typeof clientKey === "string" && clientKey.startsWith("runner:");
}

/**
 * Asset ids to download before they are live. Live ids are omitted so they are not counted
 * against the cap. Does not choose what is on the wall.
 */
export function choosePreloadAssetIds(input: {
  liveIds: string[];
  candidates: Array<{ id: string; mediaKind: string | null; sizeBytes?: number | null }>;
}): string[] {
  const live = new Set(input.liveIds.filter(Boolean));
  const items: PreloadItem[] = [];
  for (const candidate of input.candidates) {
    if (!candidate.id || live.has(candidate.id)) continue;
    if (!isWarmableKind(candidate.mediaKind)) continue;
    if (
      candidate.mediaKind === "video" &&
      typeof candidate.sizeBytes === "number" &&
      candidate.sizeBytes > LED_PRELOAD_MAX_VIDEO_BYTES
    ) {
      continue;
    }
    items.push({
      id: candidate.id,
      title: candidate.id,
      url: `preload:${candidate.id}`,
      mediaKind: candidate.mediaKind,
      source: "schedule",
      startsAt: null,
    });
  }
  return capPreloadItems(items).map((item) => item.id);
}

/**
 * Worst-case command-to-visible for the Local Runner.
 * The runner learns the new scene on its next heartbeat, then the wall player learns it on its next localhost poll.
 * A file already on disk skips the download. This is not a measurement from the venue OBS machine.
 */
export function localCommandToVisibleMs(input: {
  heartbeatMs: number;
  pollMs: number;
  downloadMs: number;
  decodeMs: number;
  fileOnDisk: boolean;
}): { ms: number; waitsForDownload: boolean } {
  const heartbeatMs = Math.max(0, input.heartbeatMs);
  const pollMs = Math.max(0, input.pollMs);
  const downloadMs = input.fileOnDisk ? 0 : Math.max(0, input.downloadMs);
  const decodeMs = Math.max(0, input.decodeMs);
  return { ms: heartbeatMs + downloadMs + pollMs + decodeMs, waitsForDownload: !input.fileOnDisk };
}

export function preloadItemToPublic(item: PreloadItem): PublicLedMedia & { source: PreloadItem["source"] } {
  return {
    id: item.id,
    title: item.title,
    url: item.url,
    mediaKind: item.mediaKind,
    source: item.source,
  };
}
