import { LedDisplay } from "@/components/screens/led-display";
import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { getPublicLedMedia } from "@/lib/queries/led-wall";
import { createAnonSupabaseClient } from "@/lib/supabase/anon";

export const dynamic = "force-dynamic";

export default async function LedDisplayPage() {
  const client = createAnonSupabaseClient();
  const media = client ? (await getPublicLedMedia(client, FLO_BAMA_VENUE_ID)).media : null;
  return <LedDisplay initial={media} />;
}
