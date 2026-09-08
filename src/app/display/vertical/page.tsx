import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { getPublicTakeover, listPublicVerticalAds } from "@/lib/queries/screens";
import { listPublicWeekEvents } from "@/lib/public/queries";
import { DEMO_VERTICAL_ADS, DEMO_WEEK_SLIDE } from "@/lib/screens/demo";
import { buildWeekSlidePayload } from "@/lib/screens/week";
import { createAnonSupabaseClient } from "@/lib/supabase/anon";
import { VerticalPlayer } from "@/components/screens/vertical-player";

export const dynamic = "force-dynamic";

export default async function VerticalDisplayPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const params = await searchParams;
  if (process.env.NODE_ENV !== "production" && params.demo === "1") {
    return <VerticalPlayer initialAds={DEMO_VERTICAL_ADS} initialWeek={DEMO_WEEK_SLIDE} lockPlaylist />;
  }
  const client = createAnonSupabaseClient();
  if (!client) return <VerticalPlayer initialAds={[]} />;
  const [{ ads }, { events }, { takeover }] = await Promise.all([
    listPublicVerticalAds(client, FLO_BAMA_VENUE_ID),
    listPublicWeekEvents(client, FLO_BAMA_VENUE_ID),
    getPublicTakeover(client, FLO_BAMA_VENUE_ID),
  ]);
  return (
    <VerticalPlayer
      initialAds={ads}
      initialWeek={buildWeekSlidePayload(events)}
      initialTakeover={takeover}
    />
  );
}
