"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export function PrintWeekToolbar({
  autoPrint = false,
  documentTitle,
}: {
  autoPrint?: boolean;
  documentTitle: string;
}) {
  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(() => window.print(), 250);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  return (
    <div className="no-print mx-auto flex w-[8.5in] max-w-full flex-wrap items-center justify-between gap-3 px-4 pt-6">
      <p className="text-sm text-[#c9b8aa]">US Letter flyer. Use Print and choose Save as PDF for a handout file.</p>
      <Button type="button" onClick={() => window.print()}>
        Print / Save PDF
      </Button>
    </div>
  );
}
