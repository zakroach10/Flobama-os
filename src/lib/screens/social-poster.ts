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

export type SocialPosterScale = {
  header: number;
  logo: number;
  title: number;
  date: number;
  name: number;
  ordinal: number;
  gap: number;
  padX: number;
  listTop: number;
  columns: 1 | 2;
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

/**
 * Scale type for the full week on one graphic.
 * Square keeps larger type; busy weeks switch to two columns instead of shrinking to unreadably small.
 */
export function socialPosterScale(id: WeekSocialFormatId, eventCount = 0): SocialPosterScale {
  const busy = eventCount >= 6;
  const packed = eventCount >= 9;

  switch (id) {
    case "story":
      if (!busy) {
        return { header: 520, logo: 520, title: 52, date: 34, name: 42, ordinal: 20, gap: 28, padX: 56, listTop: 36, columns: 1 };
      }
      if (!packed) {
        return { header: 440, logo: 420, title: 40, date: 26, name: 34, ordinal: 15, gap: 16, padX: 40, listTop: 24, columns: 2 };
      }
      return { header: 380, logo: 360, title: 34, date: 22, name: 28, ordinal: 13, gap: 12, padX: 32, listTop: 18, columns: 2 };

    case "ig-portrait":
      if (!busy) {
        return { header: 430, logo: 460, title: 46, date: 32, name: 40, ordinal: 18, gap: 22, padX: 48, listTop: 32, columns: 1 };
      }
      if (!packed) {
        return { header: 340, logo: 380, title: 34, date: 24, name: 30, ordinal: 14, gap: 14, padX: 36, listTop: 20, columns: 2 };
      }
      return { header: 300, logo: 340, title: 30, date: 20, name: 26, ordinal: 12, gap: 10, padX: 28, listTop: 16, columns: 2 };

    case "ig-square":
      // Prefer one readable page: larger type than before, two columns when the week is busy.
      if (!busy) {
        return { header: 300, logo: 380, title: 40, date: 30, name: 38, ordinal: 17, gap: 20, padX: 44, listTop: 28, columns: 1 };
      }
      if (!packed) {
        return { header: 260, logo: 340, title: 32, date: 22, name: 28, ordinal: 13, gap: 12, padX: 28, listTop: 18, columns: 2 };
      }
      return { header: 230, logo: 300, title: 28, date: 18, name: 24, ordinal: 11, gap: 8, padX: 22, listTop: 14, columns: 2 };

    case "landscape":
      if (eventCount < 9) {
        return { header: 300, logo: 400, title: 36, date: 26, name: 32, ordinal: 14, gap: 16, padX: 48, listTop: 22, columns: 2 };
      }
      return { header: 240, logo: 340, title: 28, date: 20, name: 26, ordinal: 12, gap: 10, padX: 36, listTop: 14, columns: 2 };
  }
}

export function socialPosterColumns(rows: SocialPosterRow[], columns: 1 | 2) {
  if (columns === 1 || rows.length <= 4) return [rows];
  const mid = Math.ceil(rows.length / 2);
  return [rows.slice(0, mid), rows.slice(mid)];
}
