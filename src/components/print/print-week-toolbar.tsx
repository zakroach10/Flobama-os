"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function PrintWeekToolbar({
  autoPrint = false,
  documentTitle,
  mode = "flyer",
}: {
  autoPrint?: boolean;
  documentTitle: string;
  mode?: "flyer" | "social";
}) {
  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  useEffect(() => {
    if (!autoPrint || mode !== "flyer") return;
    const timer = window.setTimeout(() => window.print(), 250);
    return () => window.clearTimeout(timer);
  }, [autoPrint, mode]);

  return (
    <div className="no-print mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 pt-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:pt-6">
      <p className="text-sm text-[#444]">
        {mode === "social"
          ? "Download a PNG at the size you need, then post it."
          : "US Letter flyer. Use Print and choose Save as PDF for a handout file."}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {mode === "flyer" ? (
          <>
            <Button type="button" variant="outline" className="w-full sm:w-auto" render={<Link href="/print/week/social" />}>
              Social sizes
            </Button>
            <Button type="button" className="w-full sm:w-auto" onClick={() => window.print()}>
              Print / Save PDF
            </Button>
          </>
        ) : (
          <Button type="button" variant="outline" className="w-full sm:w-auto" render={<Link href="/print/week" />}>
            Weekly flyer
          </Button>
        )}
      </div>
    </div>
  );
}
