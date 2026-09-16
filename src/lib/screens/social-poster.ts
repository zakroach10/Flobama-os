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
  /** How the lineup fills leftover vertical space. */
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

/** Instagram square: always one column; enlarge lineup type so the week fills the cream area. */
function igSquareScale(eventCount: number): SocialPosterScale {
  const count = Math.max(1, eventCount);
  if (count <= 3) {
    return {
      header: 280,
      logo: 360,
      title: 38,
      date: 34,
      name: 44,
      ordinal: 18,
      gap: 22,
      padX: 40,
      listTop: 24,
      padBottom: 20,
      columns: 1,
      listJustify: "start",
    };
  }
  if (count <= 5) {
    return {
      header: 250,
      logo: 320,
      title: 34,
      date: 30,
      name: 40,
      ordinal: 16,
      gap: 16,
      padX: 36,
      listTop: 18,
      padBottom: 16,
      columns: 1,
      listJustify: "start",
    };
  }
  if (count <= 7) {
    return {
      header: 220,
      logo: 280,
      title: 30,
      date: 26,
      name: 34,
      ordinal: 14,
      gap: 12,
      padX: 32,
      listTop: 14,
      padBottom: 12,
      columns: 1,
      listJustify: "start",
    };
  }
  if (count <= 9) {
    return {
      header: 200,
      logo: 250,
      title: 26,
      date: 22,
      name: 30,
      ordinal: 12,
      gap: 8,
      padX: 28,
      listTop: 10,
      padBottom: 10,
      columns: 1,
      listJustify: "start",
    };
  }
  return {
    header: 180,
    logo: 220,
    title: 24,
    date: 18,
    name: 24,
    ordinal: 10,
    gap: 6,
    padX: 24,
    listTop: 8,
    padBottom: 8,
    columns: 1,
    listJustify: "start",
  };
}

/**
 * Landscape: compact header + larger stacked type in two tight columns,
 * top-aligned (no stretched gaps between shows).
 */
function landscapeScale(eventCount: number): SocialPosterScale {
  const count = Math.max(1, eventCount);
  if (count <= 4) {
    return {
      header: 200,
      logo: 360,
      title: 32,
      date: 28,
      name: 36,
      ordinal: 15,
      gap: 18,
      padX: 48,
      listTop: 36,
      padBottom: 40,
      columns: 1,
      listJustify: "start",
    };
  }
  if (count <= 8) {
    return {
      header: 180,
      logo: 320,
      title: 28,
      date: 24,
      name: 32,
      ordinal: 13,
      gap: 14,
      padX: 40,
      listTop: 24,
      padBottom: 28,
      columns: 2,
      listJustify: "start",
    };
  }
  return {
    header: 160,
    logo: 280,
    title: 24,
    date: 20,
    name: 26,
    ordinal: 11,
    gap: 10,
    padX: 32,
    listTop: 16,
    padBottom: 20,
    columns: 2,
    listJustify: "start",
  };
}

/**
 * Scale type for the full week on one graphic.
 * Square stays one column with larger lineup type.
 * Landscape uses a compact header and top-aligned columns (no stretched gaps).
 */
export function socialPosterScale(id: WeekSocialFormatId, eventCount = 0): SocialPosterScale {
  const busy = eventCount >= 6;
  const packed = eventCount >= 9;

  switch (id) {
    case "story":
      if (!busy) {
        return {
          header: 520,
          logo: 520,
          title: 52,
          date: 34,
          name: 42,
          ordinal: 20,
          gap: 28,
          padX: 56,
          listTop: 36,
          padBottom: 36,
          columns: 1,
          listJustify: "start",
        };
      }
      if (!packed) {
        return {
          header: 440,
          logo: 420,
          title: 40,
          date: 26,
          name: 34,
          ordinal: 15,
          gap: 16,
          padX: 40,
          listTop: 24,
          padBottom: 24,
          columns: 2,
          listJustify: "start",
        };
      }
      return {
        header: 380,
        logo: 360,
        title: 34,
        date: 22,
        name: 28,
        ordinal: 13,
        gap: 12,
        padX: 32,
        listTop: 18,
        padBottom: 18,
        columns: 2,
        listJustify: "start",
      };

    case "ig-portrait":
      if (!busy) {
        return {
          header: 430,
          logo: 460,
          title: 46,
          date: 32,
          name: 40,
          ordinal: 18,
          gap: 22,
          padX: 48,
          listTop: 32,
          padBottom: 32,
          columns: 1,
          listJustify: "start",
        };
      }
      if (!packed) {
        return {
          header: 340,
          logo: 380,
          title: 34,
          date: 24,
          name: 30,
          ordinal: 14,
          gap: 14,
          padX: 36,
          listTop: 20,
          padBottom: 20,
          columns: 2,
          listJustify: "start",
        };
      }
      return {
        header: 300,
        logo: 340,
        title: 30,
        date: 20,
        name: 26,
        ordinal: 12,
        gap: 10,
        padX: 28,
        listTop: 16,
        padBottom: 16,
        columns: 2,
        listJustify: "start",
      };

    case "ig-square":
      return igSquareScale(eventCount);

    case "landscape":
      return landscapeScale(eventCount);
  }
}

export function socialPosterColumns(rows: SocialPosterRow[], columns: 1 | 2) {
  if (columns === 1 || rows.length <= 4) return [rows];
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
