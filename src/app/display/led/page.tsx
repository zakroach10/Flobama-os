import { LedDisplay } from "@/components/screens/led-display";
import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { getPublicAppUrl } from "@/lib/env";
import { joinPublicUrl } from "@/lib/public/urls";
import { getPublicLedMedia } from "@/lib/queries/led-wall";
import { createAnonSupabaseClient } from "@/lib/supabase/anon";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { buildPublicWallState } from "@/lib/trivia/runtime";

export const dynamic = "force-dynamic";

export default async function LedDisplayPage() {
  const client = createAnonSupabaseClient();
  const media = client ? (await getPublicLedMedia(client, FLO_BAMA_VENUE_ID)).media : null;

  let trivia = null;
  const admin = createServiceRoleClient();
  if (admin) {
    const origin = getPublicAppUrl();
    const wall = await buildPublicWallState(admin, FLO_BAMA_VENUE_ID, (code) =>
      joinPublicUrl(origin, `/play/${code}`),
    );
    trivia = wall.wall;
  }

  return <LedDisplay initial={media} initialTrivia={trivia} />;
}
