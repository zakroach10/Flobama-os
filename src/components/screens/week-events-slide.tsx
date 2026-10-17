"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { WeekLineup } from "@/components/brand/week-lineup";
import { fitScale } from "@/lib/screens/frame";
import { liveWeekDays, type WeekSlidePayload } from "@/lib/screens/week";

export function WeekEventsSlide({
  week,
  loading = false,
}: {
  week: WeekSlidePayload | null;
  loading?: boolean;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const lineupRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const days = liveWeekDays(week?.days ?? []);
  const lineupKey = [
    week?.rangeLabel ?? "",
    loading ? "loading" : "ready",
    ...days.map((day) => `${day.dateKey}:${day.events.map((event) => `${event.id}:${event.name}:${event.time}`).join(",")}`),
  ].join("|");

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const lineup = lineupRef.current;
    if (!frame || !lineup) return;

    const measure = () => {
      const next = fitScale(frame.clientHeight, lineup.offsetHeight);
      setScale((current) => (Math.abs(current - next) < 0.005 ? current : next));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(lineup);
    return () => observer.disconnect();
  }, [lineupKey]);

  return (
    <div ref={frameRef} className="h-full w-full overflow-hidden">
      <div
        ref={lineupRef}
        className="w-full origin-top"
        style={scale < 0.999 ? { transform: `scale(${scale})` } : undefined}
      >
        <WeekLineup
          rangeLabel={week?.rangeLabel ?? (loading ? "Loading calendar" : "This week")}
          days={days}
          tone="dark"
          size="kiosk"
        />
      </div>
    </div>
  );
}
