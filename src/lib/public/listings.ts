import { DateTime } from "luxon";
import { DEFAULT_VENUE_TIMEZONE, type EventType } from "@/lib/constants";

export type StaffEventForPublic = {
  id: string;
  title: string;
  event_type: EventType;
  starts_at: string;
  ends_at: string;
  location_label: string | null;
  featured: boolean;
  is_ticketed?: boolean;
  ticket_url?: string | null;
  cover_label?: string | null;
  status: "draft" | "published" | "cancelled";
  visibility: "public" | "private";
  archived_at: string | null;
  internal_notes?: string | null;
  created_by?: string | null;
  artists?: string[];
};

export type PublicEventJson = {
  id: string;
  name: string;
  day: string;
  date: string;
  time: string;
  display: string;
  ticketed: boolean;
  ticketUrl: string | null;
  coverCharge: string | null;
  startsAt: string;
  endsAt: string;
  eventType: EventType;
  locationLabel: string | null;
  featured: boolean;
  artists: string[];
};

const PUBLIC_KEYS = [
  "id",
  "name",
  "day",
  "date",
  "time",
  "display",
  "ticketed",
  "ticketUrl",
  "coverCharge",
  "startsAt",
  "endsAt",
  "eventType",
  "locationLabel",
  "featured",
  "artists",
] as const;

export function isPubliclyListable(event: StaffEventForPublic): boolean {
  return event.status === "published" && event.visibility === "public" && event.archived_at === null;
}

export function toPublicEventJson(
  event: StaffEventForPublic,
  timeZone: string = DEFAULT_VENUE_TIMEZONE,
): PublicEventJson | null {
  if (!isPubliclyListable(event)) return null;

  const local = DateTime.fromISO(event.starts_at, { zone: "utc" }).setZone(timeZone);
  return {
    id: event.id,
    name: event.title,
    day: local.toFormat("cccc"),
    date: local.toFormat("LLL d, yyyy"),
    time: local.toFormat("h:mm a"),
    display: local.toFormat("ccc, LLL d • h:mm a"),
    ticketed: Boolean(event.is_ticketed),
    ticketUrl: event.ticket_url ?? null,
    coverCharge: event.cover_label ?? null,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    eventType: event.event_type,
    locationLabel: event.location_label,
    featured: event.featured,
    artists: event.artists ?? [],
  };
}

export function assertNoInternalFields(payload: PublicEventJson): boolean {
  const keys = Object.keys(payload);
  if (keys.some((key) => !PUBLIC_KEYS.includes(key as (typeof PUBLIC_KEYS)[number]))) {
    return false;
  }
  const encoded = JSON.stringify(payload);
  return !/internal_notes|internalNotes|created_by|createdBy|legacy_source_id/i.test(encoded);
}

export function parsePublicRange(
  from: string | null,
  to: string | null,
  upcomingOnly: boolean,
  now: Date = new Date(),
  timeZone: string = DEFAULT_VENUE_TIMEZONE,
): { fromIso: string | null; toIso: string | null } {
  const parseBound = (value: string | null, endOfDay: boolean) => {
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const dt = DateTime.fromISO(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}`, { zone: timeZone });
      return dt.isValid ? (endOfDay ? dt.endOf("day").toUTC().toISO() : dt.toUTC().toISO()) : null;
    }
    const dt = DateTime.fromISO(value, { setZone: true });
    return dt.isValid ? dt.toUTC().toISO() : null;
  };

  let fromIso = parseBound(from, false);
  const toIso = parseBound(to, true);
  if (!fromIso && upcomingOnly) {
    fromIso = DateTime.fromJSDate(now).toUTC().toISO();
  }
  return { fromIso, toIso };
}

export function parseLimit(raw: string | null, fallback = 80, max = 200): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}
