import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { publicJson, publicOptions } from "@/lib/public/http";
import { listPublicVerticalAds } from "@/lib/queries/screens";
import { createAnonSupabaseClient } from "@/lib/supabase/anon";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return publicOptions();
}

export async function GET() {
  const client = createAnonSupabaseClient();
  if (!client) return publicJson({ error: "Public listings are not configured." }, 503);
  const { ads, error } = await listPublicVerticalAds(client, FLO_BAMA_VENUE_ID);
  if (error) return publicJson({ error }, 500);
  return publicJson({ ads, count: ads.length });
}
