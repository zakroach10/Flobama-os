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

export function socialPosterScale(id: WeekSocialFormatId) {
  switch (id) {
    case "story":
      return { header: 520, logo: 520, title: 52, date: 34, name: 42, ordinal: 20, gap: 28, padX: 56, listTop: 36, columns: 1 as const };
    case "ig-portrait":
      return { header: 430, logo: 460, title: 46, date: 30, name: 38, ordinal: 18, gap: 22, padX: 48, listTop: 32, columns: 1 as const };
    case "ig-square":
      return { header: 360, logo: 420, title: 36, date: 24, name: 30, ordinal: 15, gap: 18, padX: 40, listTop: 28, columns: 1 as const };
    case "landscape":
      return { header: 320, logo: 420, title: 34, date: 24, name: 30, ordinal: 14, gap: 18, padX: 56, listTop: 24, columns: 2 as const };
  }
}

export function socialPosterColumns(rows: SocialPosterRow[], columns: 1 | 2) {
  if (columns === 1 || rows.length <= 4) return [rows];
  const mid = Math.ceil(rows.length / 2);
  return [rows.slice(0, mid), rows.slice(mid)];
}
