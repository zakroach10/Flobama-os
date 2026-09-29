import { liveWeekDays, weekFlyerFileName, type WeekSlideDay } from "@/lib/screens/week";

export const WEEK_SOCIAL_FORMATS = [
  {
    id: "ig-square",
    label: "Instagram square",
    hint: "Feed post · 1080×1080",
    width: 1080,
    height: 1080,
    layout: "stack",
  },
  {
    id: "ig-portrait",
    label: "Instagram portrait",
    hint: "Feed 4:5 · 1080×1350",
    width: 1080,
    height: 1350,
    layout: "stack",
  },
  {
    id: "story",
    label: "Story and Reels",
    hint: "Instagram, TikTok, Shorts · 1080×1920",
    width: 1080,
    height: 1920,
    layout: "stack",
  },
  {
    id: "landscape",
    label: "Landscape",
    hint: "Facebook, X, YouTube · 1920×1080",
    width: 1920,
    height: 1080,
    layout: "split",
  },
] as const;

export type WeekSocialFormat = (typeof WEEK_SOCIAL_FORMATS)[number];
export type WeekSocialFormatId = WeekSocialFormat["id"];

export const DEFAULT_WEEK_SOCIAL_FORMAT: WeekSocialFormatId = "ig-square";

export function isWeekSocialFormatId(value: string | null | undefined): value is WeekSocialFormatId {
  return WEEK_SOCIAL_FORMATS.some((format) => format.id === value);
}

export function weekSocialFormat(id: string | null | undefined): WeekSocialFormat {
  return WEEK_SOCIAL_FORMATS.find((format) => format.id === id) ?? WEEK_SOCIAL_FORMATS[0];
}

/** Always one page — busy weeks pack into columns instead of paginating. */
export function weekSocialPages(days: WeekSlideDay[]) {
  return [liveWeekDays(days)];
}

export function socialGraphicFileName(
  rangeLabel: string,
  formatId: WeekSocialFormatId,
  page = 1,
  pageCount = 1,
) {
  const base = weekFlyerFileName(rangeLabel);
  const pagePart = pageCount > 1 ? `-p${page}` : "";
  return `${base}-${formatId}${pagePart}.png`;
}

export function weekSocialQuery(options: { formatId: WeekSocialFormatId; page?: number; demo?: boolean }) {
  const params = new URLSearchParams({ size: options.formatId });
  if (options.page && options.page > 1) params.set("page", String(options.page));
  if (options.demo) params.set("demo", "1");
  return params.toString();
}

export function weekSocialStudioPath(options: { formatId: WeekSocialFormatId; page?: number; demo?: boolean }) {
  return `/print/week/social?${weekSocialQuery(options)}`;
}

export function weekSocialExportPath(options: { formatId: WeekSocialFormatId; page?: number; demo?: boolean }) {
  return `/api/public/v1/screens/week/social?${weekSocialQuery(options)}`;
}

export function weekSocialComposePath(options: { formatId: WeekSocialFormatId; page?: number }) {
  const params = new URLSearchParams({ size: options.formatId });
  if (options.page && options.page > 1) params.set("page", String(options.page));
  return `/social/compose?${params.toString()}`;
}
