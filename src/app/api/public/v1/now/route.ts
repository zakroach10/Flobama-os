import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { publicJson, publicOptions } from "@/lib/public/http";
import { getPublicNow } from "@/lib/public/queries";
import { createAnonSupabaseClient } from "@/lib/supabase/anon";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return publicOptions();
}

export async function GET() {
  const client = createAnonSupabaseClient();
  if (!client) {
    return publicJson({ error: "Public listings are not configured." }, 503);
  }
  const result = await getPublicNow(client, FLO_BAMA_VENUE_ID);
  if (result.error) return publicJson({ error: result.error }, 500);
  return publicJson({
    today: result.today,
    nowPlaying: result.nowPlaying,
    next: result.next,
    lowerThirdVisible: result.lowerThirdVisible,
  });
}
