import { DateTime, IANAZone } from "luxon";
import { DEFAULT_VENUE_TIMEZONE } from "@/lib/constants";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

export type VenueLocalParseSuccess = {
  ok: true;
  iso: string;
  dateTime: DateTime;
};

export type VenueLocalParseFailure = {
  ok: false;
  code: "invalid_format" | "invalid_local" | "ambiguous_local" | "invalid_zone";
  message: string;
};

export type VenueLocalParseResult = VenueLocalParseSuccess | VenueLocalParseFailure;

export function assertIanaZone(timeZone: string): boolean {
  return IANAZone.isValidZone(timeZone);
}

function wallClockKey(date: string, time: string): string {
  return `${date}T${time}`;
}

export function parseVenueLocalDateTime(
  date: string,
  time: string,
  timeZone: string = DEFAULT_VENUE_TIMEZONE,
): VenueLocalParseResult {
  if (!assertIanaZone(timeZone)) {
    return {
      ok: false,
      code: "invalid_zone",
      message: `Unknown timezone: ${timeZone}`,
    };
  }
  if (!DATE_PATTERN.test(date) || !TIME_PATTERN.test(time)) {
    return {
      ok: false,
      code: "invalid_format",
      message: "Enter a valid date and time.",
    };
  }

  const localIso = wallClockKey(date, time);
  const dt = DateTime.fromISO(localIso, { zone: timeZone });
  if (!dt.isValid) {
    return {
      ok: false,
      code: "invalid_local",
      message: `That local time does not exist in ${timeZone} (often during a spring-forward daylight-saving gap). Choose another time.`,
    };
  }

  if (countLocalInterpretations(date, time, timeZone) > 1) {
    return {
      ok: false,
      code: "ambiguous_local",
      message: `That local time is ambiguous in ${timeZone} because clocks fall back. Choose a time outside the repeated hour.`,
    };
  }

  const iso = dt.toUTC().toISO();
  if (!iso) {
    return {
      ok: false,
      code: "invalid_local",
      message: "Could not convert that local time to UTC.",
    };
  }

  return { ok: true, iso, dateTime: dt };
}

export function countLocalInterpretations(
  date: string,
  time: string,
  timeZone: string,
): number {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const start = DateTime.fromObject(
    { year, month, day, hour: 0, minute: 0, second: 0 },
    { zone: timeZone },
  ).minus({ hours: 3 });
  const end = start.plus({ hours: 30 });
  const seen = new Set<number>();

  for (let cursor = start; cursor < end; cursor = cursor.plus({ minutes: 15 })) {
    const shifted = cursor.setZone(timeZone);
    if (
      shifted.year === year &&
      shifted.month === month &&
      shifted.day === day &&
      shifted.hour === hour &&
      shifted.minute === minute
    ) {
      seen.add(shifted.toUTC().toMillis());
    }
  }
  return seen.size;
}

export function formatVenueDateTime(
  iso: string,
  timeZone: string = DEFAULT_VENUE_TIMEZONE,
  pattern: string = "ccc, LLL d, yyyy • h:mm a",
): string {
  return DateTime.fromISO(iso, { zone: "utc" }).setZone(timeZone).toFormat(pattern);
}

export function formatVenueTime(
  iso: string,
  timeZone: string = DEFAULT_VENUE_TIMEZONE,
): string {
  return DateTime.fromISO(iso, { zone: "utc" }).setZone(timeZone).toFormat("h:mm a");
}

export function formatVenueDate(
  iso: string,
  timeZone: string = DEFAULT_VENUE_TIMEZONE,
): string {
  return DateTime.fromISO(iso, { zone: "utc" }).setZone(timeZone).toFormat("ccc, LLL d");
}

export function toVenueDateInput(
  iso: string,
  timeZone: string = DEFAULT_VENUE_TIMEZONE,
): string {
  return DateTime.fromISO(iso, { zone: "utc" }).setZone(timeZone).toFormat("yyyy-LL-dd");
}

export function toVenueTimeInput(
  iso: string,
  timeZone: string = DEFAULT_VENUE_TIMEZONE,
): string {
  return DateTime.fromISO(iso, { zone: "utc" }).setZone(timeZone).toFormat("HH:mm");
}

export function venueDayBounds(
  instant: Date = new Date(),
  timeZone: string = DEFAULT_VENUE_TIMEZONE,
): { start: DateTime; end: DateTime } {
  const local = DateTime.fromJSDate(instant, { zone: timeZone });
  const start = local.startOf("day");
  const end = start.plus({ days: 1 });
  return { start, end };
}

export function eventOverlapsVenueDay(
  startsAtIso: string,
  endsAtIso: string,
  instant: Date = new Date(),
  timeZone: string = DEFAULT_VENUE_TIMEZONE,
): boolean {
  const { start, end } = venueDayBounds(instant, timeZone);
  const startsAt = DateTime.fromISO(startsAtIso, { zone: "utc" });
  const endsAt = DateTime.fromISO(endsAtIso, { zone: "utc" });
  return startsAt < end && endsAt > start;
}

export function formatVenueTodayHeading(
  instant: Date = new Date(),
  timeZone: string = DEFAULT_VENUE_TIMEZONE,
): string {
  return DateTime.fromJSDate(instant, { zone: timeZone }).toFormat("cccc, LLLL d, yyyy");
}

export function nowInVenue(
  instant: Date = new Date(),
  timeZone: string = DEFAULT_VENUE_TIMEZONE,
): DateTime {
  return DateTime.fromJSDate(instant, { zone: timeZone });
}
