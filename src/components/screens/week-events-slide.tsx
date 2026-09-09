"use client";

import { useEffect, useState } from "react";
import { WeekLineup } from "@/components/brand/week-lineup";
import { fillVenueWeekDays, paginateWeekDays, type WeekSlidePayload } from "@/lib/screens/week";

export function WeekEventsSlide({
  week,
  loading = false,
}: {
  week: WeekSlidePayload | null;
  loading?: boolean;
}) {
  const crowded = (week?.eventCount ?? 0) > 12;
  const filled = fillVenueWeekDays(week?.days ?? []);
  const pages = crowded ? paginateWeekDays(week?.days ?? []) : [filled];
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (pages.length <= 1) return;
    const timer = window.setInterval(() => {
      setPage((value) => (value + 1) % pages.length);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [pages.length]);

  const current = pages[page % pages.length] ?? [];

  return (
    <WeekLineup
      rangeLabel={week?.rangeLabel ?? (loading ? "Loading calendar" : "This week")}
      days={current}
      tone="dark"
      size="kiosk"
      pageLabel={pages.length > 1 ? `${page + 1} / ${pages.length}` : null}
    />
  );
}
