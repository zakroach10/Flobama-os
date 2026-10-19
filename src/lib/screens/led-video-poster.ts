/**
 * Extract a PNG still from an MP4 loop for menu thumbnails.
 * Mobile Safari often blank-renders <video preload="metadata"> in grids.
 */

export type LedVideoPosterResult = {
  blob: Blob;
  width: number;
  height: number;
};

function waitForEvent(target: EventTarget, event: string, errorEvent = "error") {
  return new Promise<void>((resolve, reject) => {
    const onOk = () => {
      cleanup();
      resolve();
    };
    const onErr = () => {
      cleanup();
      reject(new Error(`Video ${event} failed.`));
    };
    const cleanup = () => {
      target.removeEventListener(event, onOk);
      target.removeEventListener(errorEvent, onErr);
    };
    target.addEventListener(event, onOk, { once: true });
    target.addEventListener(errorEvent, onErr, { once: true });
  });
}

/** Capture one frame from a local File/Blob or object URL. */
export async function extractVideoPosterPng(
  source: Blob | string,
  options?: { seekSeconds?: number; maxEdge?: number },
): Promise<LedVideoPosterResult | null> {
  if (typeof document === "undefined") return null;

  const seekSeconds = options?.seekSeconds ?? 0.08;
  const maxEdge = options?.maxEdge ?? 720;
  const objectUrl = typeof source === "string" ? source : URL.createObjectURL(source);
  const shouldRevoke = typeof source !== "string";

  const video = document.createElement("video");
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "true");
  video.preload = "auto";
  // Local blobs do not need CORS; remote URLs may taint the canvas without it.
  if (typeof source === "string" && !source.startsWith("blob:")) {
    video.crossOrigin = "anonymous";
  }

  try {
    const loaded = waitForEvent(video, "loadeddata");
    video.src = objectUrl;
    await loaded;

    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      // Some encoders omit duration until a play attempt.
      try {
        await video.play();
        video.pause();
      } catch {
        // ignore — still try to draw whatever frame we have
      }
    }

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const target =
      duration > 0 ? Math.min(seekSeconds, Math.max(0, duration * 0.02)) : seekSeconds;

    if (video.currentTime !== target) {
      const seeked = waitForEvent(video, "seeked");
      video.currentTime = target;
      await seeked;
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;

    const scale = Math.min(1, maxEdge / Math.max(vw, vh));
    const width = Math.max(1, Math.round(vw * scale));
    const height = Math.max(1, Math.round(vh * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((next) => resolve(next), "image/png");
    });
    if (!blob || blob.size === 0) return null;
    return { blob, width, height };
  } catch {
    return null;
  } finally {
    video.removeAttribute("src");
    video.load();
    if (shouldRevoke) URL.revokeObjectURL(objectUrl);
  }
}

/** Prefer a still for menus; fall back to the media URL only for images. */
export function ledMenuPreviewUrl(scene: {
  media_kind?: string | null;
  public_url?: string | null;
  poster_url?: string | null;
}): string | null {
  if (scene.media_kind === "video") {
    return scene.poster_url?.trim() || null;
  }
  return scene.public_url?.trim() || scene.poster_url?.trim() || null;
}
