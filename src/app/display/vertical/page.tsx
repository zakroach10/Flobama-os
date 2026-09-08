import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { listPublicVerticalAds } from "@/lib/queries/screens";
import { DEMO_VERTICAL_ADS } from "@/lib/screens/demo";
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
    return <VerticalPlayer initialAds={DEMO_VERTICAL_ADS} lockPlaylist />;
  }
  const client = createAnonSupabaseClient();
  const ads = client ? (await listPublicVerticalAds(client, FLO_BAMA_VENUE_ID)).ads : [];
  return <VerticalPlayer initialAds={ads} />;
}
