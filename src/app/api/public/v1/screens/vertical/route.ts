import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { getPublicAppUrl } from "@/lib/env";
import { PUBLIC_NO_STORE, publicJson, publicOptions } from "@/lib/public/http";
import { listPublicWeekEvents } from "@/lib/public/queries";
import { joinPublicUrl } from "@/lib/public/urls";
import { getPublicTakeover, listPublicVerticalAds } from "@/lib/queries/screens";
import { normalizePublicPlaylist } from "@/lib/screens/playlist";
import { displayRevision, normalizePublicTakeover } from "@/lib/screens/takeover";
import { buildWeekSlidePayload } from "@/lib/screens/week";
import { createAnonSupabaseClient } from "@/lib/supabase/anon";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isMissingTriviaRelation } from "@/lib/trivia/engine";
import { buildPublicWallState } from "@/lib/trivia/runtime";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return publicOptions();
}

export async function GET() {
  const client = createAnonSupabaseClient();
  if (!client) return publicJson({ error: "Public listings are not configured." }, 503);
  const [{ ads, error }, weekRes, takeoverRes] = await Promise.all([
    listPublicVerticalAds(client, FLO_BAMA_VENUE_ID),
    listPublicWeekEvents(client, FLO_BAMA_VENUE_ID),
    getPublicTakeover(client, FLO_BAMA_VENUE_ID),
  ]);
  if (error) return publicJson({ error }, 500);
  const playlist = normalizePublicPlaylist(ads);
  const takeover = normalizePublicTakeover(takeoverRes.takeover);

  let trivia = null as null | {
    joinCode: string;
    joinUrl: string;
    packTitle: string;
    playerCount: number;
    status: string;
    sessionId: string;
  };
  const admin = createServiceRoleClient();
  if (admin) {
    const origin = getPublicAppUrl();
    const wall = await buildPublicWallState(admin, FLO_BAMA_VENUE_ID, (code) =>
      joinPublicUrl(origin, `/play/${code}`),
    );
    if (wall.error && !isMissingTriviaRelation(wall.error)) {
      return publicJson({ error: wall.error }, 500);
    }
    if (wall.wall) {
      trivia = {
        joinCode: wall.wall.joinCode,
        joinUrl: joinPublicUrl(origin, `/play/${wall.wall.joinCode}`),
        packTitle: wall.wall.packTitle,
        playerCount: wall.wall.playerCount,
        status: wall.wall.status,
        sessionId: wall.wall.sessionId,
      };
    }
  }

  const triviaKey = trivia ? `${trivia.sessionId}:${trivia.status}:${trivia.playerCount}:${trivia.joinCode}` : null;

  return publicJson(
    {
      ads: playlist,
      count: playlist.length,
      revision: displayRevision(playlist, takeover, triviaKey),
      week: weekRes.error ? null : buildWeekSlidePayload(weekRes.events),
      takeover,
      trivia,
    },
    200,
    PUBLIC_NO_STORE,
  );
}
