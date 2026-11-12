/** Portrait still saved from the booth. The live kiosks are 1080×1920. */
export const PHOTO_BOOTH_WIDTH = 1080;
export const PHOTO_BOOTH_HEIGHT = 1620;
export const PHOTO_BOOTH_FOOTER = 300;
export const PHOTO_BOOTH_IMAGE_HEIGHT = PHOTO_BOOTH_HEIGHT - PHOTO_BOOTH_FOOTER;

/** Matches DEFAULT_VENUE_TIMEZONE without pulling staff constants into the kiosk bundle. */
export const PHOTO_BOOTH_TIME_ZONE = "America/Chicago";

/** Guest photos are unlisted and removed after this. */
export const PHOTO_BOOTH_RETENTION_MS = 48 * 60 * 60 * 1000;

/** Canvas JPEG cap. A 1080×1620 frame at normal quality is well under this. */
export const PHOTO_BOOTH_MAX_BYTES = 1_800_000;

export const PHOTO_BOOTH_BUCKET = "photo-booth";

/** One kiosk shares an IP, so this is a booth pace limit, not a per-guest limit. */
export const PHOTO_BOOTH_IP_LIMIT = 30;
export const PHOTO_BOOTH_IP_WINDOW_MS = 10 * 60 * 1000;

/** Caps a script spraying the public upload from many addresses. */
export const PHOTO_BOOTH_VENUE_LIMIT = 400;
export const PHOTO_BOOTH_VENUE_WINDOW_MS = 24 * 60 * 60 * 1000;

export const PHOTO_BOOTH_PREVIEW_IDLE_MS = 90_000;
export const PHOTO_BOOTH_REVIEW_IDLE_MS = 60_000;
export const PHOTO_BOOTH_SHARE_IDLE_MS = 45_000;
export const PHOTO_BOOTH_ERROR_IDLE_MS = 30_000;
export const PHOTO_BOOTH_COUNTDOWN_SECONDS = 3;

export const PHOTO_BOOTH_CAMERA_STORAGE_KEY = "flobama.photoBooth.cameraId";

export function photoBoothIdleMs(phase: "preview" | "review" | "share" | "error"): number {
  switch (phase) {
    case "preview":
      return PHOTO_BOOTH_PREVIEW_IDLE_MS;
    case "review":
      return PHOTO_BOOTH_REVIEW_IDLE_MS;
    case "share":
      return PHOTO_BOOTH_SHARE_IDLE_MS;
    case "error":
      return PHOTO_BOOTH_ERROR_IDLE_MS;
  }
}

export function photoBoothExpiresAt(now: Date): Date {
  return new Date(now.getTime() + PHOTO_BOOTH_RETENTION_MS);
}
