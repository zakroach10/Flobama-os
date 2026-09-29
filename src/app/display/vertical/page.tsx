import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { getPublicAppUrl } from "@/lib/env";
import { getPublicTakeover, listPublicVerticalAds } from "@/lib/queries/screens";
import { listPublicWeekEvents } from "@/lib/public/queries";
import { joinPublicUrl } from "@/lib/public/urls";
import { DEMO_VERTICAL_ADS, DEMO_WEEK_SLIDE } from "@/lib/screens/demo";
import { buildWeekSlidePayload } from "@/lib/screens/week";
import { createAnonSupabaseClient } from "@/lib/supabase/anon";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { buildPublicWallState } from "@/lib/trivia/runtime";
import { VerticalPlayer } from "@/components/screens/vertical-player";

export const dynamic = "force-dynamic";

export default async function VerticalDisplayPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string; slide?: string }>;
}) {
  const params = await searchParams;
  if (process.env.NODE_ENV !== "production" && params.demo === "1") {
    const weekIndex = DEMO_VERTICAL_ADS.findIndex((ad) => ad.mediaKind === "week_events");
    const initialIndex = params.slide === "week" && weekIndex >= 0 ? weekIndex : 0;
    return (
      <VerticalPlayer
        initialAds={DEMO_VERTICAL_ADS}
        initialWeek={DEMO_WEEK_SLIDE}
        lockPlaylist
        initialIndex={initialIndex}
      />
    );
  }
  const client = createAnonSupabaseClient();
  if (!client) return <VerticalPlayer initialAds={[]} />;
  const [{ ads }, { events }, { takeover }] = await Promise.all([
    listPublicVerticalAds(client, FLO_BAMA_VENUE_ID),
    listPublicWeekEvents(client, FLO_BAMA_VENUE_ID),
    getPublicTakeover(client, FLO_BAMA_VENUE_ID),
  ]);

  let trivia = null;
  const admin = createServiceRoleClient();
  if (admin) {
    const origin = getPublicAppUrl();
    const wall = await buildPublicWallState(admin, FLO_BAMA_VENUE_ID, (code) =>
      joinPublicUrl(origin, `/play/${code}`),
    );
    if (wall.wall) {
      trivia = {
        joinCode: wall.wall.joinCode,
        joinUrl: joinPublicUrl(origin, `/play/${wall.wall.joinCode}`),
        packTitle: wall.wall.packTitle,
        playerCount: wall.wall.playerCount,
        status: wall.wall.status,
      };
    }
  }

  return (
    <VerticalPlayer
      initialAds={ads}
      initialWeek={buildWeekSlidePayload(events)}
      initialTakeover={takeover}
      initialTrivia={trivia}
    />
  );
}
