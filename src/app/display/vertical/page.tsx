import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { listPublicVerticalAds } from "@/lib/queries/screens";
import { createAnonSupabaseClient } from "@/lib/supabase/anon";
import { VerticalPlayer } from "@/components/screens/vertical-player";

export const dynamic = "force-dynamic";

export default async function VerticalDisplayPage() {
  const client = createAnonSupabaseClient();
  const ads = client ? (await listPublicVerticalAds(client, FLO_BAMA_VENUE_ID)).ads : [];
  return <VerticalPlayer initialAds={ads} />;
}
