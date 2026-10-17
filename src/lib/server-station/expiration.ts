import { DateTime } from "luxon";
import { DEFAULT_VENUE_TIMEZONE } from "@/lib/constants";

export type ServerStationDurationPreset = 5 | 15 | 30 | "tonight";

export function resolveServerStationEndsAt(input: {
  preset: ServerStationDurationPreset;
  timeZone?: string;
  businessNightEndHour?: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const timeZone = input.timeZone || DEFAULT_VENUE_TIMEZONE;
  const nightEndHour = input.businessNightEndHour ?? 2;

  if (input.preset === "tonight") {
    const local = DateTime.fromJSDate(now, { zone: timeZone });
    let end = local.set({ hour: nightEndHour, minute: 0, second: 0, millisecond: 0 });
    // Before the night-end hour, that time is still "tonight" from last night's perspective —
    // use today's night-end. After night-end, use tomorrow's night-end for the current business night.
    if (local.hour >= nightEndHour) {
      end = end.plus({ days: 1 });
    }
    if (end <= local) end = end.plus({ days: 1 });
    return end.toUTC().toISO()!;
  }

  return new Date(now.getTime() + input.preset * 60_000).toISOString();
}

export function durationPresetLabel(preset: ServerStationDurationPreset) {
  if (preset === "tonight") return "Tonight only";
  if (preset === 5) return "5 minutes";
  if (preset === 15) return "15 minutes";
  return "30 minutes";
}
