import { DateTime } from "luxon";
import { DEFAULT_VENUE_TIMEZONE } from "@/lib/constants";
import type { LedWallMediaKind } from "@/lib/screens/led-wall";

/** Minutes before showtime when artist LED graphics auto-roll. */
export const ARTIST_LED_AUTO_ROLL_MINUTES = 5;

/** Artist profile LED logos/loops may be up to 2 GB. */
export const MAX_ARTIST_LED_BYTES = 2 * 1024 * 1024 * 1024;

export function artistLedMediaKindForFile(file: {
  type: string;
  name: string;
}): LedWallMediaKind | null {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "mp4" || file.type === "video/mp4") return "video";
  if (
    ext === "png" ||
    ext === "jpg" ||
    ext === "jpeg" ||
    ext === "heic" ||
    ext === "heif" ||
    file.type === "image/png" ||
    file.type === "image/jpeg" ||
    file.type === "image/heic" ||
    file.type === "image/heif"
  ) {
    return "image";
  }
  return null;
}

export function artistLedFileMeta(file: { type: string; name: string }, mediaKind: LedWallMediaKind) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (mediaKind === "video") {
    return { ext: "mp4", contentType: "video/mp4" };
  }
  if (ext === "heic" || file.type === "image/heic") {
    return { ext: "heic", contentType: "image/heic" };
  }
  if (ext === "heif" || file.type === "image/heif") {
    return { ext: "heif", contentType: "image/heif" };
  }
  if (ext === "jpg" || ext === "jpeg" || file.type === "image/jpeg") {
    return { ext: "jpg", contentType: "image/jpeg" };
  }
  return { ext: "png", contentType: "image/png" };
}

/** Venue-local hour when the wall resets to the ad-roll playlist. */
export const LED_AD_ROLL_RESET_HOUR = 4;

export type LedActivationSource = "manual" | "artist_auto" | "ad_roll";

export function isArtistOwnedLedScene(scene: { artist_id?: string | null }) {
  return Boolean(scene.artist_id);
}

export function houseLedScenes<T extends { artist_id?: string | null; kind: string }>(scenes: T[]) {
  return scenes.filter((scene) => !isArtistOwnedLedScene(scene));
}

export function artistLedScenes<T extends { artist_id?: string | null; enabled: boolean }>(scenes: T[]) {
  return scenes.filter((scene) => isArtistOwnedLedScene(scene) && scene.enabled);
}

/** True when now is inside the auto-roll window: [startsAt - 5m, startsAt). */
export function isWithinArtistLedAutoWindow(
  startsAtIso: string,
  now: Date = new Date(),
  minutesBefore = ARTIST_LED_AUTO_ROLL_MINUTES,
) {
  const starts = DateTime.fromISO(startsAtIso, { zone: "utc" });
  if (!starts.isValid) return false;
  const nowUtc = DateTime.fromJSDate(now, { zone: "utc" });
  const windowOpen = starts.minus({ minutes: minutesBefore });
  return nowUtc >= windowOpen && nowUtc < starts;
}

export function venueLocalDateString(now: Date = new Date(), timeZone = DEFAULT_VENUE_TIMEZONE) {
  return DateTime.fromJSDate(now, { zone: "utc" }).setZone(timeZone).toISODate();
}

/** True during the venue-local 4:00 hour (cron may hit any minute in that hour). */
export function isAdRollResetHour(now: Date = new Date(), timeZone = DEFAULT_VENUE_TIMEZONE) {
  const local = DateTime.fromJSDate(now, { zone: "utc" }).setZone(timeZone);
  return local.hour === LED_AD_ROLL_RESET_HOUR;
}

export function shouldRunAdRollReset(input: {
  now?: Date;
  timeZone?: string;
  lastResetOn: string | null | undefined;
}) {
  const now = input.now ?? new Date();
  const timeZone = input.timeZone ?? DEFAULT_VENUE_TIMEZONE;
  if (!isAdRollResetHour(now, timeZone)) return false;
  const today = venueLocalDateString(now, timeZone);
  if (!today) return false;
  return input.lastResetOn !== today;
}

/** Prefer not to auto-interrupt trivia / audience one-shots. */
export function canAutoReplaceLedWall(activeSceneKind: string | null | undefined) {
  if (!activeSceneKind) return true;
  return activeSceneKind !== "trivia" && activeSceneKind !== "audience";
}

export function pickPrimaryArtistId(
  artists: Array<{ artist_id: string; display_order: number; hasLedConfig: boolean }>,
) {
  const withConfig = [...artists]
    .filter((row) => row.hasLedConfig)
    .sort((a, b) => a.display_order - b.display_order);
  return withConfig[0]?.artist_id ?? null;
}
