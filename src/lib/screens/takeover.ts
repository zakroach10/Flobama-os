import { DateTime } from "luxon";
import { DEFAULT_VENUE_TIMEZONE, SCREEN_TAKEOVER_MAX_MINUTES } from "@/lib/constants";
import { normalizePublicAd, playlistRevision, type PublicScreenAd } from "@/lib/screens/playlist";

export type PublicTakeover = {
  ad: PublicScreenAd;
  endsAt: string | null;
};

export type StaffTakeover = {
  adId: string;
  title: string;
  endsAt: string | null;
};

export function isMissingScreenTakeoverRelation(message: string | null | undefined) {
  return /screen_takeovers|screen_takeover_listings/i.test(message ?? "") && /does not exist|schema cache|could not find/i.test(message ?? "");
}

export function isTakeoverActive(endsAt: string | null | undefined, now: Date = new Date()) {
  if (endsAt == null) return true;
  const expires = Date.parse(endsAt);
  return Number.isFinite(expires) && expires > now.getTime();
}

export function takeoverEndsAt(minutes: number | null, now: Date = new Date()) {
  if (minutes == null) return null;
  const clamped = Math.min(SCREEN_TAKEOVER_MAX_MINUTES, Math.max(1, Math.trunc(minutes)));
  return new Date(now.getTime() + clamped * 60_000).toISOString();
}

export function takeoverMinutesLabel(minutes: number) {
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  return `${minutes} minutes`;
}

export function formatTakeoverUntil(endsAt: string | null, timeZone: string = DEFAULT_VENUE_TIMEZONE) {
  if (!endsAt) return "until you clear it";
  const local = DateTime.fromISO(endsAt, { zone: "utc" }).setZone(timeZone);
  if (!local.isValid) return "until the timer ends";
  return `until ${local.toFormat("h:mm a")}`;
}

export function takeoverRemainingLabel(endsAt: string | null, now: Date = new Date()) {
  if (!endsAt) return "Until cleared";
  const remainingMs = Date.parse(endsAt) - now.getTime();
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return "Ended";
  const minutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours}h ${rest}m left` : `${hours}h left`;
  }
  return `${minutes}m left`;
}

export function normalizePublicTakeover(raw: unknown, now: Date = new Date()): PublicTakeover | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as { ad?: PublicScreenAd; endsAt?: string | null };
  if (!value.ad?.id || !value.ad.url) return null;
  if (value.endsAt != null && !isTakeoverActive(value.endsAt, now)) return null;
  return {
    ad: normalizePublicAd(value.ad),
    endsAt: value.endsAt ?? null,
  };
}

export function displayRevision(ads: PublicScreenAd[], takeover: PublicTakeover | null) {
  const key = takeover
    ? [takeover.ad.id, takeover.ad.url, takeover.ad.mediaKind, takeover.endsAt ?? "open"].join(":")
    : "";
  return `${playlistRevision(ads)}#t:${key}`;
}
