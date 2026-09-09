import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { listPublicWeekEvents } from "@/lib/public/queries";
import { DEMO_WEEK_SLIDE } from "@/lib/screens/demo";
import {
  buildWeekSlidePayload,
  fillVenueWeekDays,
  weekFlyerFileName,
  weekFlyerTitle,
} from "@/lib/screens/week";
import { createAnonSupabaseClient } from "@/lib/supabase/anon";
import { PrintWeekToolbar } from "@/components/print/print-week-toolbar";
import { WeekFlyer } from "@/components/print/week-flyer";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "This week at FloBama",
  robots: { index: false, follow: false },
};

export default async function WeekFlyerPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string; print?: string }>;
}) {
  const params = await searchParams;
  const autoPrint = params.print === "1";
  const demo = process.env.NODE_ENV !== "production" && params.demo === "1";

  if (demo) {
    const title = weekFlyerTitle(DEMO_WEEK_SLIDE.rangeLabel);
    return (
      <>
        <PrintWeekToolbar autoPrint={autoPrint} documentTitle={weekFlyerFileName(DEMO_WEEK_SLIDE.rangeLabel)} />
        <WeekFlyer
          venueName="FloBama Music Hall"
          rangeLabel={DEMO_WEEK_SLIDE.rangeLabel}
          days={fillVenueWeekDays(DEMO_WEEK_SLIDE.days, new Date("2026-09-08T22:00:00.000Z"))}
        />
        <span className="sr-only">{title}</span>
      </>
    );
  }

  const client = createAnonSupabaseClient();
  if (!client) {
    return (
      <>
        <PrintWeekToolbar autoPrint={autoPrint} documentTitle={weekFlyerFileName("this-week")} />
        <WeekFlyer venueName="FloBama Music Hall" rangeLabel="This week" days={[]} />
      </>
    );
  }

  const { events } = await listPublicWeekEvents(client, FLO_BAMA_VENUE_ID);
  const week = buildWeekSlidePayload(events);
  const title = weekFlyerTitle(week.rangeLabel);

  return (
    <>
      <PrintWeekToolbar autoPrint={autoPrint} documentTitle={weekFlyerFileName(week.rangeLabel)} />
      <WeekFlyer venueName="FloBama Music Hall" rangeLabel={week.rangeLabel} days={fillVenueWeekDays(week.days)} />
      <span className="sr-only">{title}</span>
    </>
  );
}
