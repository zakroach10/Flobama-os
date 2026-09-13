"use client";

import { useMemo, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { WeekSocialGraphic } from "@/components/print/week-social-graphic";
import {
  DEFAULT_WEEK_SOCIAL_FORMAT,
  socialGraphicFileName,
  WEEK_SOCIAL_FORMATS,
  weekSocialExportPath,
  weekSocialFormat,
  weekSocialPages,
  type WeekSocialFormatId,
} from "@/lib/screens/social";
import type { WeekSlideDay } from "@/lib/screens/week";
import { cn } from "@/lib/utils";

export function WeekSocialStudio({
  rangeLabel,
  days,
  initialFormat = DEFAULT_WEEK_SOCIAL_FORMAT,
  demo = false,
}: {
  rangeLabel: string;
  days: WeekSlideDay[];
  initialFormat?: WeekSocialFormatId;
  demo?: boolean;
}) {
  const [formatId, setFormatId] = useState<WeekSocialFormatId>(initialFormat);
  const [page, setPage] = useState(0);
  const format = weekSocialFormat(formatId);
  const pages = useMemo(() => weekSocialPages(days, format), [days, format]);
  const current = pages[Math.min(page, pages.length - 1)] ?? [];
  const pageLabel = pages.length > 1 ? `${Math.min(page, pages.length - 1) + 1} / ${pages.length}` : null;
  const scale = previewScale(format.width, format.height);
  const currentPage = Math.min(page, pages.length - 1) + 1;
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
              <button
                type="button"
                className={buttonVariants({ variant: "outline" })}
                disabled={page === 0}
                onClick={() => setPage((value) => Math.max(0, value - 1))}
              >
                Previous page
              </button>
              <button
                type="button"
                className={buttonVariants({ variant: "outline" })}
                disabled={page >= pages.length - 1}
                onClick={() => setPage((value) => Math.min(pages.length - 1, value + 1))}
              >
                Next page
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {WEEK_SOCIAL_FORMATS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setFormatId(item.id);
              setPage(0);
            }}
            className={cn(
              "min-h-11 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
              item.id === format.id
                ? "border-[#d36b4a] bg-[#1b1612] text-[#f4ebe3]"
                : "border-[#ccc] bg-white text-[#111] hover:border-[#d36b4a]",
            )}
          >
            <span className="block font-medium">{item.label}</span>
            <span className={item.id === format.id ? "text-[#c9b8aa]" : "text-[#666]"}>{item.hint}</span>
          </button>
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
