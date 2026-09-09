import { WeekLineup } from "@/components/brand/week-lineup";
import type { WeekSlideDay } from "@/lib/screens/week";

export function WeekFlyer({
  rangeLabel,
  days,
}: {
  venueName?: string;
  rangeLabel: string;
  days: WeekSlideDay[];
}) {
  return (
    <article className="flyer-sheet mx-auto my-6 h-[11in] w-[8.5in] overflow-hidden shadow-lg print:my-0 print:shadow-none">
      <WeekLineup rangeLabel={rangeLabel} days={days} tone="light" size="flyer" />
    </article>
  );
}
