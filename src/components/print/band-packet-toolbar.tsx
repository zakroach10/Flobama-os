"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function BandPacketToolbar({
  autoPrint = false,
  documentTitle,
  count,
  subtitle,
}: {
  autoPrint?: boolean;
  documentTitle: string;
  count: number;
  subtitle: string;
}) {
  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  useEffect(() => {
    if (!autoPrint || count === 0) return;
    const timer = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(timer);
  }, [autoPrint, count]);

  return (
    <div className="no-print mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:pt-4">
      <div className="min-w-0">
        <p className="text-sm text-[#444]">
          US Letter packet · one page per submission · use Print and choose Save as PDF for management.
        </p>
        <p className="mt-0.5 text-xs text-[#666]">
          {subtitle} · {count} page{count === 1 ? "" : "s"}
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button type="button" variant="outline" className="w-full sm:w-auto" render={<Link href="/booking/submissions" />}>
          Back to submissions
        </Button>
        <Button type="button" className="w-full sm:w-auto" onClick={() => window.print()} disabled={count === 0}>
          Print / Save PDF
        </Button>
      </div>
    </div>
  );
}
