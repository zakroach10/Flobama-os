import { DateTime } from "luxon";
import type { WeekSlideDay } from "@/lib/screens/week";
import type { WeekSocialFormatId } from "@/lib/screens/social";

export const SOCIAL_POSTER = {
  cream: "#e4e2dd",
  ink: "#222222",
  blue: "#0257e8",
  title: "#e4e2dd",
  heading: "LIVE  MUSIC  THIS  WEEK",
} as const;

export const SOCIAL_POSTER_ASSETS = {
  paper: "/social/paper-orange.jpg",
  tear: "/social/paper-tear.png",
  sticker: "/social/flobama-sticker.png",
} as const;

export type SocialPosterRow = {
  id: string;
  lead: string;
  ordinal: string;
  time: string;
  name: string;
};

export function englishOrdinal(day: number) {
  const teens = day % 100;
  if (teens >= 11 && teens <= 13) return "TH";
  switch (day % 10) {
    case 1:
      return "ST";
    case 2:
      return "ND";
    case 3:
      return "RD";
    default:
      return "TH";
  }
}

export function socialPosterDateParts(dateKey: string, time: string) {
  const dt = DateTime.fromISO(dateKey);
  return {
    lead: `${dt.toFormat("EEEE").toUpperCase()} ${dt.toFormat("MMMM").toUpperCase()} ${dt.day}`,
    ordinal: englishOrdinal(dt.day),
    time: time.replace(/\s+/g, " ").trim(),
  };
}

export function socialPosterRows(days: WeekSlideDay[]): SocialPosterRow[] {
  return days.flatMap((day) =>
    day.events.map((event) => ({
      id: event.id,
      name: event.name.toUpperCase(),
      ...socialPosterDateParts(day.dateKey, event.time),
    })),
  );
}

const PORTRAIT_SCALE = {
  header: 430,
  logo: 390,
  title: 46,
  date: 30,
  name: 38,
  ordinal: 18,
  gap: 22,
  padX: 48,
  listTop: 32,
  columns: 1 as const,
};

export function socialPosterScale(id: WeekSocialFormatId) {
  const scales = { "ig-portrait": PORTRAIT_SCALE } satisfies Record<WeekSocialFormatId, typeof PORTRAIT_SCALE>;
  return scales[id];
}

export function socialPosterColumns(rows: SocialPosterRow[], columns: 1 | 2) {
  if (columns === 1 || rows.length <= 4) return [rows];
  const mid = Math.ceil(rows.length / 2);
  return [rows.slice(0, mid), rows.slice(mid)];
}
