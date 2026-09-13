import { buttonVariants } from "@/components/ui/button";
import { ScaledPreview } from "@/components/print/scaled-preview";
import { WeekSocialGraphic } from "@/components/print/week-social-graphic";
import {
  socialGraphicFileName,
  WEEK_SOCIAL_FORMATS,
  weekSocialExportPath,
  weekSocialFormat,
  weekSocialPages,
  weekSocialStudioPath,
  type WeekSocialFormatId,
} from "@/lib/screens/social";
import type { WeekSlideDay } from "@/lib/screens/week";
import { cn } from "@/lib/utils";

export function WeekSocialStudio({
  rangeLabel,
  days,
  formatId,
  page = 1,
  demo = false,
}: {
  rangeLabel: string;
  days: WeekSlideDay[];
  formatId: WeekSocialFormatId;
  page?: number;
  demo?: boolean;
}) {
  const format = weekSocialFormat(formatId);
  const pages = weekSocialPages(days, format);
  const currentPage = Math.min(Math.max(page, 1), Math.max(pages.length, 1));
  const current = pages[currentPage - 1] ?? [];
  const pageLabel = pages.length > 1 ? `${currentPage} / ${pages.length}` : null;
  const filename = socialGraphicFileName(rangeLabel, format.id, currentPage, pages.length);
  const exportHref = weekSocialExportPath({ formatId: format.id, page: currentPage, demo });

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:space-y-6 sm:py-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#111] sm:text-3xl">This week · social sizes</h1>
          <p className="mt-1 max-w-xl text-sm text-[#444]">
            Pick a size, then download a PNG for Instagram, stories, or Facebook. Busy weeks split across pages so the
            type stays readable.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <a className={cn(buttonVariants({ variant: "default" }), "w-full sm:w-auto")} href={exportHref} download={filename}>
            Download PNG
          </a>
          {pages.length > 1 ? (
            <>
              {currentPage > 1 ? (
                <a
                  className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")}
                  href={weekSocialStudioPath({ formatId: format.id, page: currentPage - 1, demo })}
                >
                  Previous page
                </a>
              ) : (
                <span className={cn(buttonVariants({ variant: "outline" }), "pointer-events-none w-full opacity-50 sm:w-auto")}>
                  Previous page
                </span>
              )}
              {currentPage < pages.length ? (
                <a
                  className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")}
                  href={weekSocialStudioPath({ formatId: format.id, page: currentPage + 1, demo })}
                >
                  Next page
                </a>
              ) : (
                <span className={cn(buttonVariants({ variant: "outline" }), "pointer-events-none w-full opacity-50 sm:w-auto")}>
                  Next page
                </span>
              )}
            </>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {WEEK_SOCIAL_FORMATS.map((item) => (
          <a
            key={item.id}
            href={weekSocialStudioPath({ formatId: item.id, demo })}
            className={cn(
              "min-h-11 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
              item.id === format.id
                ? "border-[#d36b4a] bg-[#1b1612] text-[#f4ebe3]"
                : "border-[#ccc] bg-white text-[#111] hover:border-[#d36b4a]",
            )}
          >
            <span className="block font-medium">{item.label}</span>
            <span className={item.id === format.id ? "text-[#c9b8aa]" : "text-[#666]"}>{item.hint}</span>
          </a>
        ))}
      </div>

      <figure className="overflow-hidden rounded-xl border bg-[#d6cfc8] p-3 sm:p-4">
        <ScaledPreview width={format.width} height={format.height} className="rounded-lg shadow-md">
          <WeekSocialGraphic format={format} rangeLabel={rangeLabel} days={current} pageLabel={pageLabel} />
        </ScaledPreview>
        <figcaption className="mt-3 text-center text-xs text-[#5c534c]">
          On-screen preview · {format.label} · {format.width}×{format.height}
          {pageLabel ? ` · page ${pageLabel}` : ""}
        </figcaption>
      </figure>
    </div>
  );
}
