import { DateTime } from "luxon";
import type { WeekSlideDay } from "@/lib/screens/week";
import type { WeekSocialFormatId, WeekSocialTemplateId } from "@/lib/screens/social";

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
  weekday: string;
  monthDay: string;
};

export type SocialStackTheme = {
  canvas: string;
  header: string;
  kicker: string;
  heading: string;
  range: string;
  rule: string;
  date: string;
  name: string;
  muted: string;
  align: "flex-start" | "center";
  bar: number;
  nameSize: number;
};

export const SOCIAL_STACK_THEMES = {
  night: {
    canvas: "#1b1612",
    header: "#1b1612",
    kicker: "#f4ebe3",
    heading: "#d36b4a",
    range: "#cbbbae",
    rule: "#d36b4a",
    date: "#d36b4a",
    name: "#f4ebe3",
    muted: "#cbbbae",
    align: "flex-start",
    bar: 16,
    nameSize: 46,
  },
  marquee: {
    canvas: "#0257e8",
    header: "#e4e2dd",
    kicker: "#0257e8",
    heading: "#1b1612",
    range: "#0257e8",
    rule: "#1b1612",
    date: "#e4e2dd",
    name: "#ffffff",
    muted: "#d6e4ff",
    align: "center",
    bar: 0,
    nameSize: 52,
  },
} as const satisfies Record<"night" | "marquee", SocialStackTheme>;

export const SOCIAL_TICKET_THEME = {
  canvas: "#f4f1ea",
  header: "#0257e8",
  kicker: "#f4f1ea",
  heading: "#f4f1ea",
  range: "#d6e4ff",
  chip: "#0257e8",
  chipText: "#f4f1ea",
  name: "#1b1612",
  muted: "#5c534c",
} as const;

export const SOCIAL_TEMPLATE_HEADING = "LIVE MUSIC THIS WEEK";
export const SOCIAL_TEMPLATE_KICKER = "FLO BAMA";

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
    day.events.map((event) => {
      const dt = DateTime.fromISO(day.dateKey);
      return {
        id: event.id,
        name: event.name.toUpperCase(),
        weekday: dt.toFormat("EEEE").toUpperCase(),
        monthDay: `${dt.toFormat("MMMM").toUpperCase()} ${dt.day}`,
        ...socialPosterDateParts(day.dateKey, event.time),
      };
    }),
  );
}

export function socialPosterStackTheme(id: WeekSocialTemplateId): SocialStackTheme | null {
  if (id === "night" || id === "marquee") return SOCIAL_STACK_THEMES[id];
  return null;
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
