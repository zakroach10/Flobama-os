import { WeekLineup } from "@/components/brand/week-lineup";
import { LETTER_PREVIEW_HEIGHT, LETTER_PREVIEW_WIDTH, ScaledPreview } from "@/components/print/scaled-preview";
import type { WeekSlideDay } from "@/lib/screens/week";

function FlyerSheet({ rangeLabel, days }: { rangeLabel: string; days: WeekSlideDay[] }) {
  return (
    <article className="flyer-sheet h-[11in] w-[8.5in] overflow-hidden">
      <WeekLineup rangeLabel={rangeLabel} days={days} tone="light" size="flyer" />
    </article>
  );
}

export function WeekFlyer({
  rangeLabel,
  days,
}: {
  venueName?: string;
  rangeLabel: string;
  days: WeekSlideDay[];
}) {
  return (
    <>
      <div className="no-print px-4 py-3 sm:py-4">
        <ScaledPreview
          width={LETTER_PREVIEW_WIDTH}
          height={LETTER_PREVIEW_HEIGHT}
          className="overflow-hidden rounded-sm shadow-lg"
        >
          <FlyerSheet rangeLabel={rangeLabel} days={days} />
        </ScaledPreview>
        <p className="mt-2 text-center text-xs text-[#5c534c]">On-screen preview · US Letter · 8.5 × 11 in</p>
      </div>
      <div className="hidden print:block">
        <FlyerSheet rangeLabel={rangeLabel} days={days} />
      </div>
    </>
  );
}
