/** Lightweight stills for LED loop (MP4) previews — especially Server Station on phones. */

export const LED_SCENE_POSTER_MAX_EDGE = 480;
export const LED_SCENE_POSTER_JPEG_QUALITY = 0.72;

/** Sibling poster path: `…/band-loop.mp4` → `…/band-loop.poster.jpg`. */
export function ledScenePosterStoragePath(storagePath: string): string {
  const cleaned = storagePath.trim().replace(/^\//, "");
  if (!cleaned) return cleaned;
  if (/\.poster\.(jpe?g|png|webp)$/i.test(cleaned)) return cleaned;
  const dot = cleaned.lastIndexOf(".");
  const base = dot > 0 ? cleaned.slice(0, dot) : cleaned;
  return `${base}.poster.jpg`;
}

export function buildScreenAdsPublicUrl(storagePath: string, supabaseUrl: string): string {
  const base = supabaseUrl.replace(/\/$/, "");
  const cleaned = storagePath
    .replace(/^\//, "")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${base}/storage/v1/object/public/screen-ads/${cleaned}`;
}

function revokeLater(url: string) {
  try {
    URL.revokeObjectURL(url);
  } catch {
    /* ignore */
  }
}

/**
 * Grab a small JPEG still from an MP4 File or remote URL.
 * Uses muted + playsInline so iOS will decode a frame without a user gesture.
 */
export async function extractVideoPosterBlob(
  source: Blob | string,
  options?: { maxEdge?: number; quality?: number },
): Promise<Blob | null> {
  if (typeof document === "undefined") return null;

  const maxEdge = options?.maxEdge ?? LED_SCENE_POSTER_MAX_EDGE;
  const quality = options?.quality ?? LED_SCENE_POSTER_JPEG_QUALITY;
  const objectUrl = typeof source === "string" ? null : URL.createObjectURL(source);
  const src =
    typeof source === "string"
      ? source.includes("#")
        ? source
        : `${source}#t=0.001`
      : objectUrl!;

  return new Promise((resolve) => {
    const video = document.createElement("video");
    let settled = false;

    const finish = (blob: Blob | null) => {
      if (settled) return;
      settled = true;
      video.removeAttribute("src");
      try {
        video.load();
      } catch {
        /* ignore */
      }
      video.remove();
      if (objectUrl) revokeLater(objectUrl);
      resolve(blob);
    };

    const grab = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) {
        finish(null);
        return;
      }
      const scale = Math.min(1, maxEdge / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        finish(null);
        return;
      }
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      } catch {
        finish(null);
        return;
      }
      canvas.toBlob((blob) => finish(blob), "image/jpeg", quality);
    };

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    video.preload = "auto";
    video.crossOrigin = "anonymous";

    video.addEventListener(
      "error",
      () => {
        finish(null);
      },
      { once: true },
    );

    video.addEventListener(
      "seeked",
      () => {
        grab();
      },
      { once: true },
    );

    const onReady = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const target = duration > 0 ? Math.min(0.05, duration * 0.01) : 0.001;
      try {
        if (Math.abs(video.currentTime - target) > 0.001) {
          video.currentTime = target;
          return;
        }
      } catch {
        /* fall through to grab */
      }
      grab();
    };

    video.addEventListener("loadeddata", onReady, { once: true });
    video.src = src;
    void video.play().then(
      () => {
        video.pause();
      },
      () => {
        /* autoplay can fail; seek/loadeddata still often yields a frame */
      },
    );

    window.setTimeout(() => finish(null), 12_000);
  });
}

const posterCache = new Map<string, string>();
const posterInflight = new Map<string, Promise<string | null>>();

/** Session cache of object-URL stills keyed by media URL. */
export function getCachedLedPosterUrl(mediaUrl: string) {
  return posterCache.get(mediaUrl) ?? null;
}

export function cacheLedPosterUrl(mediaUrl: string, posterUrl: string) {
  const previous = posterCache.get(mediaUrl);
  if (previous && previous !== posterUrl && previous.startsWith("blob:")) {
    revokeLater(previous);
  }
  posterCache.set(mediaUrl, posterUrl);
}

/** Decode one loop at a time-ish so phones are not flooded with 20 MP4s. */
let captureChain: Promise<unknown> = Promise.resolve();

export function captureLedPosterFromMediaUrl(mediaUrl: string): Promise<string | null> {
  const cached = posterCache.get(mediaUrl);
  if (cached) return Promise.resolve(cached);

  const existing = posterInflight.get(mediaUrl);
  if (existing) return existing;

  const job = (captureChain = captureChain
    .catch(() => undefined)
    .then(async () => {
      const blob = await extractVideoPosterBlob(mediaUrl);
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      cacheLedPosterUrl(mediaUrl, url);
      return url;
    })
    .finally(() => {
      posterInflight.delete(mediaUrl);
    }));

  posterInflight.set(mediaUrl, job);
  return job;
}
