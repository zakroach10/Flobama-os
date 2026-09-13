import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { listPublicWeekEvents } from "@/lib/public/queries";
import { DEMO_WEEK_SLIDE } from "@/lib/screens/demo";
import { isWeekSocialFormatId, weekSocialFormat } from "@/lib/screens/social";
import { buildWeekSlidePayload, weekFlyerFileName, weekFlyerTitle } from "@/lib/screens/week";
import { createAnonSupabaseClient } from "@/lib/supabase/anon";
import { WeekSocialStudio } from "@/components/print/week-social-studio";
import { PrintWeekToolbar } from "@/components/print/print-week-toolbar";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "This week at FloBama · social",
  robots: { index: false, follow: false },
};

export default async function WeekSocialPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string; size?: string; page?: string }>;
}) {
  const params = await searchParams;
  const demo = process.env.NODE_ENV !== "production" && params.demo === "1";
  const format = weekSocialFormat(isWeekSocialFormatId(params.size) ? params.size : undefined);
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  if (demo) {
    return (
      <>
        <PrintWeekToolbar documentTitle={weekFlyerFileName(DEMO_WEEK_SLIDE.rangeLabel)} mode="social" />
        <WeekSocialStudio
          rangeLabel={DEMO_WEEK_SLIDE.rangeLabel}
          days={DEMO_WEEK_SLIDE.days}
          formatId={format.id}
          page={page}
          demo
        />
        <span className="sr-only">{weekFlyerTitle(DEMO_WEEK_SLIDE.rangeLabel)}</span>
      </>
    );
  }

  const client = createAnonSupabaseClient();
  if (!client) {
    return (
      <>
        <PrintWeekToolbar documentTitle={weekFlyerFileName("this-week")} mode="social" />
        <WeekSocialStudio rangeLabel="This week" days={[]} formatId={format.id} page={page} />
      </>
    );
  }

  const { events } = await listPublicWeekEvents(client, FLO_BAMA_VENUE_ID);
  const week = buildWeekSlidePayload(events);

  return (
    <>
      <PrintWeekToolbar documentTitle={weekFlyerFileName(week.rangeLabel)} mode="social" />
      <WeekSocialStudio rangeLabel={week.rangeLabel} days={week.days} formatId={format.id} page={page} />
      <span className="sr-only">{weekFlyerTitle(week.rangeLabel)}</span>
    </>
  );
}
