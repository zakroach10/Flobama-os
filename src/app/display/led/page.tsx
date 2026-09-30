import { LedDisplay } from "@/components/screens/led-display";
import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { getPublicAppUrl } from "@/lib/env";
import { joinPublicUrl } from "@/lib/public/urls";
import { getPublicDisplayReloadSignal } from "@/lib/queries/display-signals";
import { getPublicLedPlayback } from "@/lib/queries/led-playlists";
import { createAnonSupabaseClient } from "@/lib/supabase/anon";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { demoTriviaPodiumWall, demoTriviaQuestionWall, demoTriviaWall } from "@/lib/trivia/demo";
import { buildPublicWallState } from "@/lib/trivia/runtime";
import { getAudienceWallState } from "@/lib/audience/runtime";

export const dynamic = "force-dynamic";

export default async function LedDisplayPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string; phase?: string }>;
}) {
  const params = await searchParams;
  if (process.env.NODE_ENV !== "production" && params.demo === "1") {
    const origin = getPublicAppUrl();
    const trivia =
      params.phase === "question"
        ? demoTriviaQuestionWall(origin)
        : params.phase === "podium"
          ? demoTriviaPodiumWall(origin)
          : demoTriviaWall(origin);
    return <LedDisplay initial={null} initialTrivia={trivia} lockTriviaDemo />;
  }

  const client = createAnonSupabaseClient();
  const playback = client
    ? (await getPublicLedPlayback(client, FLO_BAMA_VENUE_ID)).playback
    : {
        mode: "idle" as const,
        active: null,
        playlist: [],
        playlistId: null,
        startedAt: null,
        revision: "idle",
      };
  const reloadNonce = client
    ? (await getPublicDisplayReloadSignal(client, FLO_BAMA_VENUE_ID)).signal.reloadNonce
    : 1;

  let trivia = null;
  let audience = null;
  const admin = createServiceRoleClient();
  if (admin) {
    const origin = getPublicAppUrl();
    const wall = await buildPublicWallState(admin, FLO_BAMA_VENUE_ID, (code) =>
      joinPublicUrl(origin, `/play/${code}`),
    );
    trivia = wall.wall;
    const audienceWall = await getAudienceWallState(admin, FLO_BAMA_VENUE_ID);
    audience = audienceWall.ok ? audienceWall.wall : null;
  }

  return (
    <LedDisplay
      initial={playback.active}
      initialPlaylist={playback.playlist}
      initialMode={playback.mode}
      initialRevision={playback.revision}
      initialReloadNonce={reloadNonce}
      initialTrivia={trivia}
      initialAudience={audience}
    />
  );
}
