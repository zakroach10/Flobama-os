import { liveWeekDays, paginateWeekDays, weekFlyerFileName, type WeekSlideDay } from "@/lib/screens/week";

export const WEEK_SOCIAL_FORMATS = [
  {
    id: "ig-portrait",
    label: "Instagram Portrait",
    hint: "Feed 4:5 · 1080×1350",
    width: 1080,
    height: 1350,
    layout: "stack",
    maxEvents: 8,
  },
] as const;

export type WeekSocialFormat = (typeof WEEK_SOCIAL_FORMATS)[number];
export type WeekSocialFormatId = WeekSocialFormat["id"];

export const DEFAULT_WEEK_SOCIAL_FORMAT: WeekSocialFormatId = "ig-portrait";

/** Visual treatments for the 1080×1350 Instagram portrait. Paper stays the default. */
export const WEEK_SOCIAL_TEMPLATES = [
  { id: "paper", label: "Paper poster", hint: "Torn orange header on cream" },
  { id: "night", label: "Night hall", hint: "Cream type on a dark field" },
  { id: "marquee", label: "Marquee", hint: "Blue field with cream type" },
  { id: "ticket", label: "Ticket stub", hint: "A day chip beside each show" },
] as const;

export type WeekSocialTemplate = (typeof WEEK_SOCIAL_TEMPLATES)[number];
export type WeekSocialTemplateId = WeekSocialTemplate["id"];

export const DEFAULT_WEEK_SOCIAL_TEMPLATE: WeekSocialTemplateId = "paper";

export function isWeekSocialFormatId(value: string | null | undefined): value is WeekSocialFormatId {
  return WEEK_SOCIAL_FORMATS.some((format) => format.id === value);
}

export function isWeekSocialTemplateId(value: string | null | undefined): value is WeekSocialTemplateId {
  return WEEK_SOCIAL_TEMPLATES.some((template) => template.id === value);
}

export function weekSocialTemplate(id: string | null | undefined): WeekSocialTemplate {
  return WEEK_SOCIAL_TEMPLATES.find((template) => template.id === id) ?? WEEK_SOCIAL_TEMPLATES[0];
}

export function weekSocialFormat(id: string | null | undefined): WeekSocialFormat {
  return WEEK_SOCIAL_FORMATS.find((format) => format.id === id) ?? WEEK_SOCIAL_FORMATS[0];
}

export function weekSocialPages(days: WeekSlideDay[], format: Pick<WeekSocialFormat, "maxEvents">) {
  return paginateWeekDays(liveWeekDays(days), format.maxEvents);
}

export function socialGraphicFileName(
  rangeLabel: string,
  formatId: WeekSocialFormatId,
  page = 1,
  pageCount = 1,
  templateId?: string | null,
) {
  const base = weekFlyerFileName(rangeLabel);
  const template = weekSocialTemplate(templateId);
  const templatePart = template.id === DEFAULT_WEEK_SOCIAL_TEMPLATE ? "" : `-${template.id}`;
  const pagePart = pageCount > 1 ? `-p${page}` : "";
  return `${base}-${formatId}${templatePart}${pagePart}.png`;
}

export type WeekSocialLinkOptions = {
  formatId: WeekSocialFormatId;
  page?: number;
  demo?: boolean;
  templateId?: string | null;
};

function appendSocialTemplate(params: URLSearchParams, templateId?: string | null) {
  const template = weekSocialTemplate(templateId);
  if (template.id !== DEFAULT_WEEK_SOCIAL_TEMPLATE) params.set("template", template.id);
}

export function weekSocialQuery(options: WeekSocialLinkOptions) {
  const params = new URLSearchParams({ size: options.formatId });
  appendSocialTemplate(params, options.templateId);
  if (options.page && options.page > 1) params.set("page", String(options.page));
  if (options.demo) params.set("demo", "1");
  return params.toString();
}

export function weekSocialStudioPath(options: WeekSocialLinkOptions) {
  return `/print/week/social?${weekSocialQuery(options)}`;
}

export function weekSocialExportPath(options: WeekSocialLinkOptions) {
  return `/api/public/v1/screens/week/social?${weekSocialQuery(options)}`;
}

export function weekSocialComposePath(options: WeekSocialLinkOptions) {
  const params = new URLSearchParams({ size: options.formatId });
  appendSocialTemplate(params, options.templateId);
  if (options.page && options.page > 1) params.set("page", String(options.page));
  return `/social/compose?${params.toString()}`;
}
