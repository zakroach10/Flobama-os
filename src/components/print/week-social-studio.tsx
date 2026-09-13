"use client";

import { useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WeekSocialGraphic } from "@/components/print/week-social-graphic";
import {
  DEFAULT_WEEK_SOCIAL_FORMAT,
  socialGraphicFileName,
  WEEK_SOCIAL_FORMATS,
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
}: {
  rangeLabel: string;
  days: WeekSlideDay[];
  initialFormat?: WeekSocialFormatId;
}) {
  const exportRef = useRef<HTMLDivElement>(null);
  const [formatId, setFormatId] = useState<WeekSocialFormatId>(initialFormat);
  const [page, setPage] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const format = weekSocialFormat(formatId);
  const pages = useMemo(() => weekSocialPages(days, format), [days, format]);
  const current = pages[Math.min(page, pages.length - 1)] ?? [];
  const pageLabel = pages.length > 1 ? `${Math.min(page, pages.length - 1) + 1} / ${pages.length}` : null;
  const scale = previewScale(format.width, format.height);

  async function downloadCurrent() {
    const node = exportRef.current;
    if (!node) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 1,
        width: format.width,
        height: format.height,
        backgroundColor: "#1b1612",
        style: { position: "relative", left: "0", top: "0" },
      });
      const link = document.createElement("a");
      const currentPage = Math.min(page, pages.length - 1) + 1;
      link.download = socialGraphicFileName(rangeLabel, format.id, currentPage, pages.length);
      link.href = dataUrl;
      link.click();
      toast.success(`Saved ${format.label} PNG.`);
    } catch {
      toast.error("Could not export that graphic. Try again in Chrome or Safari.");
    } finally {
      setDownloading(false);
    }
  }

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
          <Button type="button" disabled={downloading} onClick={() => void downloadCurrent()}>
            {downloading ? "Exporting…" : "Download PNG"}
          </Button>
          {pages.length > 1 ? (
            <>
              <Button type="button" variant="outline" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>
                Previous page
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={page >= pages.length - 1}
                onClick={() => setPage((value) => Math.min(pages.length - 1, value + 1))}
              >
                Next page
              </Button>
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

      <div className="pointer-events-none fixed top-0 -left-[4000px]" aria-hidden>
        <div ref={exportRef}>
          <WeekSocialGraphic format={format} rangeLabel={rangeLabel} days={current} pageLabel={pageLabel} />
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
