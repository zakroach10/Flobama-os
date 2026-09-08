import { DateTime } from "luxon";
import type { PublicEventJson } from "@/lib/public/listings";
import { DEFAULT_VENUE_TIMEZONE } from "@/lib/constants";
import { venueWeekBounds } from "@/lib/timezone";

export type WeekSlideEvent = {
  id: string;
  name: string;
  time: string;
  artists: string[];
  ticketed: boolean;
  coverCharge: string | null;
  featured: boolean;
};

export type WeekSlideDay = {
  dateKey: string;
  weekday: string;
  dateLabel: string;
  events: WeekSlideEvent[];
};

export type WeekSlidePayload = {
  heading: string;
  rangeLabel: string;
  timezone: string;
  days: WeekSlideDay[];
  eventCount: number;
};

export function formatWeekRangeLabel(start: DateTime, endExclusive: DateTime): string {
  const last = endExclusive.minus({ days: 1 });
  if (start.year === last.year && start.month === last.month) {
    return `${start.toFormat("LLL d")}–${last.toFormat("d, yyyy")}`;
  }
  if (start.year === last.year) {
    return `${start.toFormat("LLL d")}–${last.toFormat("LLL d, yyyy")}`;
  }
  return `${start.toFormat("LLL d, yyyy")}–${last.toFormat("LLL d, yyyy")}`;
}

export function toWeekSlideEvent(event: PublicEventJson): WeekSlideEvent {
  return {
    id: event.id,
    name: event.name,
    time: event.time,
    artists: event.artists,
    ticketed: event.ticketed,
    coverCharge: event.coverCharge,
    featured: event.featured,
  };
}

export function weekEventLineupMeta(event: Pick<WeekSlideEvent, "time" | "artists">) {
  const parts = [event.time];
  if (event.artists.length > 0) parts.push(event.artists.join(", "));
  return parts.join(" · ");
}

export function groupEventsByVenueDay(
  events: PublicEventJson[],
  timeZone: string = DEFAULT_VENUE_TIMEZONE,
): WeekSlideDay[] {
  const byDay = new Map<string, WeekSlideDay>();
  const sorted = [...events].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  for (const event of sorted) {
    const local = DateTime.fromISO(event.startsAt, { zone: "utc" }).setZone(timeZone);
    const dateKey = local.toFormat("yyyy-LL-dd");
    const existing = byDay.get(dateKey);
    const item = toWeekSlideEvent(event);
    if (existing) {
      existing.events.push(item);
      continue;
    }
    byDay.set(dateKey, {
      dateKey,
      weekday: local.toFormat("cccc"),
      dateLabel: local.toFormat("LLL d"),
      events: [item],
    });
  }
  return [...byDay.values()];
}

export function buildWeekSlidePayload(
  events: PublicEventJson[],
  instant: Date = new Date(),
  timeZone: string = DEFAULT_VENUE_TIMEZONE,
): WeekSlidePayload {
  const { start, end } = venueWeekBounds(instant, timeZone);
  return {
    heading: "This week",
    rangeLabel: formatWeekRangeLabel(start, end),
    timezone: timeZone,
    days: groupEventsByVenueDay(events, timeZone),
    eventCount: events.length,
  };
}

export function paginateWeekDays(days: WeekSlideDay[], maxEventsPerPage = 8): WeekSlideDay[][] {
  const pages: WeekSlideDay[][] = [];
  let current: WeekSlideDay[] = [];
  let count = 0;

  function flush() {
    if (current.length === 0) return;
    pages.push(current);
    current = [];
    count = 0;
  }

  for (const day of days) {
    if (day.events.length === 0) continue;
    const chunks =
      day.events.length <= maxEventsPerPage
        ? [day]
        : chunk(day.events, maxEventsPerPage).map((events) => ({ ...day, events }));
    for (const piece of chunks) {
      if (count > 0 && count + piece.events.length > maxEventsPerPage) flush();
      current.push(piece);
      count += piece.events.length;
    }
  }
  flush();
  return pages.length > 0 ? pages : [[]];
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}
