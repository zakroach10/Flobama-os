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
  align: "center";
  bar: number;
  dateSize: number;
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
    align: "center",
    bar: 16,
    dateSize: 34,
    nameSize: 60,
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
    dateSize: 34,
    nameSize: 62,
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
/** Official wordmark. 1500×488, transparent. */
export const SOCIAL_TEMPLATE_LOGO = { width: 520, height: 169 } as const;

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
  logo: 420,
  title: 52,
  date: 36,
  name: 48,
  ordinal: 20,
  gap: 18,
  padX: 48,
  listTop: 16,
  columns: 1 as const,
};

export function socialPosterScale(id: WeekSocialFormatId) {
  const scales = { "ig-portrait": PORTRAIT_SCALE } satisfies Record<WeekSocialFormatId, typeof PORTRAIT_SCALE>;
  return scales[id];
}

/** Matches the line box used by the PNG renderer. */
export const SOCIAL_LINE_HEIGHT = 1.12;

/** Room kept between the lineup block and the header / bottom edge. */
const LINEUP_SLACK = 24;
/** Roboto Bold uppercase advance, a little high so wrap estimates don't run short. */
const NAME_ADVANCE = 0.66;
const SPACE_ADVANCE = 0.25;

export type SocialLineupLayout = {
  header: number;
  listHeight: number;
  contentWidth: number;
  dateSize: number;
  nameSize: number;
  ordinalSize: number;
  gap: number;
  nameGap: number;
  lineHeight: number;
  chipFont: number;
  chipPadY: number;
  chipPadX: number;
  padTop: number;
  padBottom: number;
  padX: number;
};

type LineupKind = "paper" | "stack" | "ticket";

type LineupDesign = {
  kind: LineupKind;
  header: number;
  padTop: number;
  padBottom: number;
  padX: number;
  date: number;
  name: number;
  ordinalRatio: number;
  gap: number;
  nameGap: number;
  chipFont: number;
  chipPadY: number;
  chipPadX: number;
};

function lineupDesign(templateId: WeekSocialTemplateId): LineupDesign {
  if (templateId === "ticket") {
    return {
      kind: "ticket",
      header: 360,
      padTop: 24,
      padBottom: 36,
      padX: 48,
      date: 28,
      name: 58,
      ordinalRatio: 0.5,
      gap: 16,
      nameGap: 8,
      chipFont: 28,
      chipPadY: 10,
      chipPadX: 22,
    };
  }
  if (templateId === "night" || templateId === "marquee") {
    const theme = SOCIAL_STACK_THEMES[templateId];
    return {
      kind: "stack",
      header: 360,
      padTop: 24,
      padBottom: 36,
      padX: 56,
      date: theme.dateSize,
      name: theme.nameSize,
      ordinalRatio: 0.55,
      gap: 14,
      nameGap: 4,
      chipFont: theme.dateSize,
      chipPadY: 0,
      chipPadX: 0,
    };
  }
  return {
    kind: "paper",
    header: PORTRAIT_SCALE.header,
    padTop: PORTRAIT_SCALE.listTop,
    padBottom: 36,
    padX: PORTRAIT_SCALE.padX,
    date: PORTRAIT_SCALE.date,
    name: PORTRAIT_SCALE.name,
    ordinalRatio: PORTRAIT_SCALE.ordinal / PORTRAIT_SCALE.date,
    gap: PORTRAIT_SCALE.gap,
    nameGap: 2,
    chipFont: PORTRAIT_SCALE.date,
    chipPadY: 0,
    chipPadX: 0,
  };
}

function nameLineCount(name: string, fontSize: number, maxWidth: number) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || maxWidth <= 0) return 1;
  const space = fontSize * SPACE_ADVANCE;
  let lines = 1;
  let used = 0;
  for (const word of words) {
    const width = word.length * fontSize * NAME_ADVANCE;
    if (used === 0) {
      used = width;
      continue;
    }
    if (used + space + width <= maxWidth) used += space + width;
    else {
      lines += 1;
      used = width;
    }
  }
  return lines;
}

function rowBlockHeight(layout: SocialLineupLayout, lines: number) {
  const name = layout.nameSize * layout.lineHeight * lines;
  if (layout.chipPadY > 0) {
    return layout.chipPadY * 2 + layout.chipFont * layout.lineHeight + layout.nameGap + name;
  }
  return layout.dateSize * layout.lineHeight + layout.nameGap + name;
}

/** Height of the show list, not counting the list's own padding. */
export function socialLineupBlockHeight(layout: SocialLineupLayout, names: string[]) {
  if (names.length === 0) return 0;
  const rows = names.reduce((sum, name) => sum + rowBlockHeight(layout, nameLineCount(name, layout.nameSize, layout.contentWidth)), 0);
  return rows + (names.length - 1) * layout.gap;
}

export function socialLineupLimit(layout: SocialLineupLayout) {
  return layout.listHeight - layout.padTop - layout.padBottom - LINEUP_SLACK;
}

function materialize(
  design: LineupDesign,
  sizes: { name: number; date: number; gap: number; nameGap: number; chipFont: number; chipPadY: number; chipPadX: number },
  canvas: { width: number; height: number },
): SocialLineupLayout {
  const chipFont = Math.max(16, sizes.chipFont);
  const dateSize = Math.max(18, sizes.date);
  const ordinalBase = design.kind === "ticket" ? chipFont : dateSize;
  return {
    header: design.header,
    listHeight: canvas.height - design.header,
    contentWidth: Math.max(120, canvas.width - design.padX * 2 - 16),
    dateSize,
    nameSize: Math.max(30, sizes.name),
    ordinalSize: Math.max(11, Math.round(ordinalBase * design.ordinalRatio)),
    gap: Math.max(6, sizes.gap),
    nameGap: Math.max(2, sizes.nameGap),
    lineHeight: SOCIAL_LINE_HEIGHT,
    chipFont,
    chipPadY: design.chipPadY === 0 ? 0 : Math.max(6, sizes.chipPadY),
    chipPadX: design.chipPadX === 0 ? 0 : Math.max(10, sizes.chipPadX),
    padTop: design.padTop,
    padBottom: design.padBottom,
    padX: design.padX,
  };
}

/**
 * Show names and dates for one portrait page.
 * A short week keeps the design size. A full page, or a title that wraps,
 * steps down until the block sits under the header in the posted PNG.
 */
export function socialLineupLayout(options: {
  templateId: WeekSocialTemplateId;
  names: string[];
  width?: number;
  height?: number;
}): SocialLineupLayout {
  const design = lineupDesign(options.templateId);
  const canvas = { width: options.width ?? 1080, height: options.height ?? 1350 };
  const names = options.names;
  let name = design.name;
  let date = design.date;
  let gap = design.gap;
  const nameGap = design.nameGap;
  let chipFont = design.chipFont;
  let chipPadY = design.chipPadY;
  let chipPadX = design.chipPadX;

  const layoutAt = () =>
    materialize(design, { name, date, gap, nameGap, chipFont, chipPadY, chipPadX }, canvas);

  let layout = layoutAt();
  if (names.length === 0) return layout;

  const budget = socialLineupLimit(layout);
  let guard = 0;
  while (socialLineupBlockHeight(layout, names) > budget && guard < 80) {
    if (name > 40) name -= 1;
    else if (gap > 8) gap -= 1;
    else if (design.kind === "ticket" && chipFont > 20) {
      chipFont -= 1;
      chipPadY = Math.max(6, chipPadY - 1);
      chipPadX = Math.max(12, chipPadX - 1);
    } else if (date > 22) date -= 1;
    else if (name > 30) name -= 1;
    else break;
    layout = layoutAt();
    guard += 1;
  }
  return layout;
}

export function socialPosterColumns(rows: SocialPosterRow[], columns: 1 | 2) {
  if (columns === 1 || rows.length <= 4) return [rows];
  const mid = Math.ceil(rows.length / 2);
  return [rows.slice(0, mid), rows.slice(mid)];
}
