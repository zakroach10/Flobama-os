import { DateTime } from "luxon";
import { DEFAULT_VENUE_TIMEZONE } from "@/lib/constants";

/**
 * Prefer POS fiscal/business date when present.
 * Otherwise assign by configurable local business-day cutoff (default 04:00 America/Chicago).
 * Luxon handles DST transitions for the venue zone.
 */
export function businessDateForOrder(input: {
  fiscalDate?: string | null;
  businessDate?: string | null;
  referenceInstant?: string | null;
  cutoffLocal?: string;
  timeZone?: string;
}): string | null {
  if (input.fiscalDate && /^\d{4}-\d{2}-\d{2}$/.test(input.fiscalDate)) return input.fiscalDate;
  if (input.businessDate && /^\d{4}-\d{2}-\d{2}$/.test(input.businessDate)) return input.businessDate;
  if (!input.referenceInstant) return null;

  const zone = input.timeZone ?? DEFAULT_VENUE_TIMEZONE;
  const cutoff = input.cutoffLocal ?? "04:00";
  const [hourText, minuteText] = cutoff.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new Error(`Invalid business-day cutoff: ${cutoff}`);
  }

  const dt = DateTime.fromISO(input.referenceInstant, { zone: "utc" }).setZone(zone);
  if (!dt.isValid) return null;

  const cutoffToday = dt.set({ hour, minute, second: 0, millisecond: 0 });
  const businessDay = dt < cutoffToday ? dt.minus({ days: 1 }) : dt;
  return businessDay.toISODate();
}

export function businessDayWindowUtc(input: {
  businessDate: string;
  cutoffLocal?: string;
  timeZone?: string;
}): { startUtc: string; endUtc: string } {
  const zone = input.timeZone ?? DEFAULT_VENUE_TIMEZONE;
  const cutoff = input.cutoffLocal ?? "04:00";
  const [hourText, minuteText] = cutoff.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const start = DateTime.fromISO(`${input.businessDate}T00:00:00`, { zone }).set({
    hour,
    minute,
    second: 0,
    millisecond: 0,
  });
  if (!start.isValid) throw new Error(`Invalid business date: ${input.businessDate}`);
  const end = start.plus({ days: 1 });
  return {
    startUtc: start.toUTC().toISO()!,
    endUtc: end.toUTC().toISO()!,
  };
}

export function splitRangeIntoExportWindows(
  start: Date,
  end: Date,
  maxWindowMs: number,
): Array<{ start: Date; end: Date }> {
  if (end <= start) return [];
  const windows: Array<{ start: Date; end: Date }> = [];
  let cursor = start.getTime();
  const endMs = end.getTime();
  while (cursor < endMs) {
    const next = Math.min(endMs, cursor + maxWindowMs);
    windows.push({ start: new Date(cursor), end: new Date(next) });
    cursor = next;
  }
  return windows;
}
