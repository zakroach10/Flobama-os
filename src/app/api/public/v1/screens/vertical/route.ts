import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { PUBLIC_NO_STORE, publicJson, publicOptions } from "@/lib/public/http";
import { listPublicWeekEvents } from "@/lib/public/queries";
import { getPublicTakeover, listPublicVerticalAds } from "@/lib/queries/screens";
import { normalizePublicPlaylist } from "@/lib/screens/playlist";
import { displayRevision, normalizePublicTakeover } from "@/lib/screens/takeover";
import { buildWeekSlidePayload } from "@/lib/screens/week";
import { createAnonSupabaseClient } from "@/lib/supabase/anon";

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
  return publicJson(
    {
      ads: playlist,
      count: playlist.length,
      revision: displayRevision(playlist, takeover),
      week: weekRes.error ? null : buildWeekSlidePayload(weekRes.events),
      takeover,
    },
    200,
    PUBLIC_NO_STORE,
  );
}
