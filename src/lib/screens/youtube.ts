/** Parse and normalize YouTube watch / share / embed / shorts URLs for the LED wall. */

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

/** Safety cap when the player cannot report an ended event (hours). */
export const YOUTUBE_WALL_MAX_HOURS = 4;

export type ParsedYoutubeVideo = {
  videoId: string;
  watchUrl: string;
  embedUrl: string;
  title: string;
  storagePath: string;
};

export function isYoutubeMediaKind(mediaKind: string | null | undefined) {
  return mediaKind === "youtube";
}

export function isYoutubeWallUrl(url: string | null | undefined) {
  if (!url) return false;
  return parseYoutubeVideoUrl(url) != null;
}

export function youtubeEmbedUrl(videoId: string) {
  const id = videoId.trim();
  return `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1`;
}

export function youtubeWatchUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId.trim())}`;
}

export function youtubeStoragePath(videoId: string) {
  return `dynamic/youtube/${videoId.trim()}`;
}

/**
 * Accept common paste formats from phones and browsers.
 * Returns null when the text is not a single YouTube video link.
 */
export function parseYoutubeVideoUrl(raw: string): ParsedYoutubeVideo | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 800) return null;

  let url: URL;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    url = new URL(withProtocol);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return null;

  let videoId: string | null = null;

  if (host === "youtu.be" || host === "www.youtu.be") {
    const pathId = url.pathname.replace(/^\/+/, "").split("/")[0] ?? "";
    videoId = sanitizeVideoId(pathId);
  } else {
    const path = url.pathname.replace(/\/+$/, "");
    if (path === "/watch" || path.startsWith("/watch")) {
      videoId = sanitizeVideoId(url.searchParams.get("v") ?? "");
    } else if (path.startsWith("/embed/") || path.startsWith("/shorts/") || path.startsWith("/live/")) {
      const segment = path.split("/")[2] ?? "";
      videoId = sanitizeVideoId(segment);
    } else if (path.startsWith("/v/")) {
      videoId = sanitizeVideoId(path.split("/")[2] ?? "");
    }
  }

  if (!videoId) return null;

  return {
    videoId,
    watchUrl: youtubeWatchUrl(videoId),
    embedUrl: youtubeEmbedUrl(videoId),
    title: `YouTube · ${videoId}`,
    storagePath: youtubeStoragePath(videoId),
  };
}

function sanitizeVideoId(raw: string) {
  const id = raw.trim();
  // Standard YouTube ids are 11 chars; allow a little slack for rarer ids.
  if (!/^[A-Za-z0-9_-]{6,20}$/.test(id)) return null;
  return id;
}

export function youtubeWallEndsAt(now = new Date()) {
  return new Date(now.getTime() + YOUTUBE_WALL_MAX_HOURS * 60 * 60 * 1000).toISOString();
}
