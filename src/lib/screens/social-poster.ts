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
  padBottom: number;
  columns: 1 | 2;
  listJustify: "start" | "between" | "center";
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
 * One-column formats (square / 4:5 / story): grow lineup type to fill the cream
 * area so the bottom isn’t empty. Never switches to two columns.
 */
function singleColumnScale(
  canvasHeight: number,
  eventCount: number,
  opts: {
    headerMax: number;
    headerMin: number;
    logoMax: number;
    logoMin: number;
    titleMax: number;
    titleMin: number;
    dateMax: number;
    nameMax: number;
    padX: number;
  },
): SocialPosterScale {
  const count = Math.max(1, eventCount);
  const t = Math.min(1, (count - 1) / 11);
  const header = Math.round(opts.headerMax - (opts.headerMax - opts.headerMin) * t);
  const logo = Math.round(opts.logoMax - (opts.logoMax - opts.logoMin) * t);
  const title = Math.round(opts.titleMax - (opts.titleMax - opts.titleMin) * t);
  const listTop = count <= 4 ? 20 : count <= 8 ? 14 : 10;
  const padBottom = count <= 4 ? 18 : count <= 8 ? 12 : 8;
  const available = Math.max(200, canvasHeight - header - listTop - padBottom);
  const gap = Math.max(6, Math.min(28, Math.round(available / count * 0.14)));
  const rowBudget = available / count - gap;
  // Prefer large band names; date a bit smaller.
  const name = Math.max(22, Math.min(opts.nameMax, Math.round(rowBudget * 0.58)));
  const date = Math.max(16, Math.min(opts.dateMax, Math.round(rowBudget * 0.36)));
  const ordinal = Math.max(9, Math.round(date * 0.55));

  return {
    header,
    logo,
    title,
    date,
    name,
    ordinal,
    gap,
    padX: opts.padX,
    listTop,
    padBottom,
    columns: 1,
    listJustify: "start",
  };
}

/** Landscape only: two columns for busier weeks; top-aligned, larger type. */
function landscapeScale(eventCount: number): SocialPosterScale {
  const count = Math.max(1, eventCount);
  if (count <= 4) {
    return {
      header: 200,
      logo: 360,
      title: 32,
      date: 30,
      name: 40,
      ordinal: 16,
      gap: 20,
      padX: 48,
      listTop: 32,
      padBottom: 36,
      columns: 1,
      listJustify: "start",
    };
  }
  // Two columns — type sized for ~half the shows per column.
  const perCol = Math.ceil(count / 2);
  const header = count <= 8 ? 180 : 160;
  const available = 1080 - header - 20 - 24;
  const gap = Math.max(10, Math.min(22, Math.round(available / perCol * 0.12)));
  const rowBudget = available / perCol - gap;
  const name = Math.max(24, Math.min(40, Math.round(rowBudget * 0.55)));
  const date = Math.max(18, Math.min(28, Math.round(rowBudget * 0.34)));
  return {
    header,
    logo: count <= 8 ? 320 : 280,
    title: count <= 8 ? 28 : 24,
    date,
    name,
    ordinal: Math.max(10, Math.round(date * 0.55)),
    gap,
    padX: 40,
    listTop: 20,
    padBottom: 24,
    columns: 2,
    listJustify: "start",
  };
}

/**
 * Square, 4:5, and story are always one column with large lineup type.
 * Only landscape uses two columns.
 */
export function socialPosterScale(id: WeekSocialFormatId, eventCount = 0): SocialPosterScale {
  switch (id) {
    case "ig-square":
      return singleColumnScale(1080, eventCount, {
        headerMax: 280,
        headerMin: 170,
        logoMax: 360,
        logoMin: 210,
        titleMax: 38,
        titleMin: 22,
        dateMax: 36,
        nameMax: 48,
        padX: 36,
      });

    case "ig-portrait":
      return singleColumnScale(1350, eventCount, {
        headerMax: 360,
        headerMin: 200,
        logoMax: 420,
        logoMin: 240,
        titleMax: 44,
        titleMin: 26,
        dateMax: 38,
        nameMax: 52,
        padX: 40,
      });

    case "story":
      return singleColumnScale(1920, eventCount, {
        headerMax: 480,
        headerMin: 260,
        logoMax: 500,
        logoMin: 280,
        titleMax: 52,
        titleMin: 30,
        dateMax: 42,
        nameMax: 56,
        padX: 48,
      });

    case "landscape":
      return landscapeScale(eventCount);
  }
}

export function socialPosterColumns(rows: SocialPosterRow[], columns: 1 | 2) {
  if (columns === 1) return [rows];
  if (rows.length <= 1) return [rows];
  const mid = Math.ceil(rows.length / 2);
  return [rows.slice(0, mid), rows.slice(mid)];
}

export function socialPosterListJustify(value: SocialPosterScale["listJustify"]) {
  switch (value) {
    case "between":
      return "space-between";
    case "center":
      return "center";
    default:
      return "flex-start";
  }
}
