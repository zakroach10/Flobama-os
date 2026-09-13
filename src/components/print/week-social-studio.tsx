import { buttonVariants } from "@/components/ui/button";
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
  const scale = previewScale(format.width, format.height);
  const filename = socialGraphicFileName(rangeLabel, format.id, currentPage, pages.length);
  const exportHref = weekSocialExportPath({ formatId: format.id, page: currentPage, demo });

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#111]">This week · social sizes</h1>
          <p className="mt-1 max-w-xl text-sm text-[#444]">
            Pick a size, then download a PNG for Instagram, stories, or Facebook. Busy weeks split across pages so the
            type stays readable.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className={buttonVariants({ variant: "default" })} href={exportHref} download={filename}>
            Download PNG
          </a>
          {pages.length > 1 ? (
            <>
              {currentPage > 1 ? (
                <a
                  className={buttonVariants({ variant: "outline" })}
                  href={weekSocialStudioPath({ formatId: format.id, page: currentPage - 1, demo })}
                >
                  Previous page
                </a>
              ) : (
                <span className={cn(buttonVariants({ variant: "outline" }), "pointer-events-none opacity-50")}>Previous page</span>
              )}
              {currentPage < pages.length ? (
                <a
                  className={buttonVariants({ variant: "outline" })}
                  href={weekSocialStudioPath({ formatId: format.id, page: currentPage + 1, demo })}
                >
                  Next page
                </a>
              ) : (
                <span className={cn(buttonVariants({ variant: "outline" }), "pointer-events-none opacity-50")}>Next page</span>
              )}
            </>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
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

      <div className="overflow-auto rounded-xl border bg-[#d6cfc8] p-4">
        <div className="mx-auto" style={{ width: format.width * scale, height: format.height * scale }}>
          <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
            <WeekSocialGraphic format={format} rangeLabel={rangeLabel} days={current} pageLabel={pageLabel} />
          </div>
        </div>
      </div>
    </div>
  );
}

function previewScale(width: number, height: number) {
  const maxWidth = 720;
  const maxHeight = 820;
  return Math.min(1, maxWidth / width, maxHeight / height);
}
