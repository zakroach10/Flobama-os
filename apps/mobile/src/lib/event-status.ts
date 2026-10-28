import { DateTime } from "luxon";

import { VENUE_TIMEZONE } from "@/src/config";
import type { PublicEventJson } from "@/src/types";

export function venueNow(now: Date = new Date()): DateTime {
  return DateTime.fromJSDate(now, { zone: "utc" }).setZone(VENUE_TIMEZONE);
}

export function isHappeningNow(event: PublicEventJson, now: Date = new Date()): boolean {
  const nowMs = now.getTime();
  const start = Date.parse(event.startsAt);
  const end = Date.parse(event.endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  return start <= nowMs && end > nowMs;
}

export function formatVenueClock(now: Date = new Date()): string {
  return venueNow(now).toFormat("cccc, LLL d · h:mm a");
}

export function coverLabel(event: PublicEventJson): string | null {
  const raw = event.coverCharge?.trim();
  if (!raw) return null;
  return raw;
}
