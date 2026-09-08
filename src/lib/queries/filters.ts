import { DateTime } from "luxon";
import type { EventStatus, EventType } from "@/lib/constants";
import { venueDayBounds } from "@/lib/timezone";

export type EventWindow = "upcoming" | "past" | "cancelled" | "archived";

export type EventListFilters = {
  window: EventWindow;
  query: string;
  status: EventStatus | "all";
  eventType: EventType | "all";
  fromDate: string | null;
  toDate: string | null;
  page: number;
  pageSize: number;
  timeZone: string;
};

export function parseEventListFilters(
  searchParams: Record<string, string | string[] | undefined>,
  pageSize: number,
  timeZone: string,
): EventListFilters {
  const first = (key: string) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const windowValue = first("window");
  const window: EventWindow =
    windowValue === "past" ||
    windowValue === "cancelled" ||
    windowValue === "archived"
      ? windowValue
      : "upcoming";

  const status = first("status");
  const eventType = first("eventType");
  const page = Math.max(1, Number.parseInt(first("page") ?? "1", 10) || 1);

  return {
    window,
    query: (first("q") ?? "").trim(),
    status:
      status === "draft" || status === "published" || status === "cancelled"
        ? status
        : "all",
    eventType:
      eventType === "live_music" ||
      eventType === "karaoke" ||
      eventType === "dj" ||
      eventType === "sports" ||
      eventType === "private_event" ||
      eventType === "other"
        ? eventType
        : "all",
    fromDate: first("from") || null,
    toDate: first("to") || null,
    page,
    pageSize,
    timeZone,
  };
}

export function summaryFilters(nowIso: string) {
  const now = DateTime.fromISO(nowIso, { zone: "utc" });
  return {
    nextSevenEnd: now.plus({ days: 7 }).toISO()!,
    now: now.toISO()!,
  };
}

export function todayOverlapFilter(now: Date, timeZone: string) {
  const { start, end } = venueDayBounds(now, timeZone);
  return { startIso: start.toUTC().toISO()!, endIso: end.toUTC().toISO()! };
}
