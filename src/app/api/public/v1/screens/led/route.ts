import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { PUBLIC_NO_STORE, publicJson, publicOptions } from "@/lib/public/http";
import { getPublicLedMedia } from "@/lib/queries/led-wall";
import { createAnonSupabaseClient } from "@/lib/supabase/anon";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return publicOptions();
}

export async function GET() {
  const client = createAnonSupabaseClient();
  if (!client) return publicJson({ error: "Public listings are not configured." }, 503);
  const { media, error } = await getPublicLedMedia(client, FLO_BAMA_VENUE_ID);
  if (error) return publicJson({ error }, 500);
  return publicJson({ active: media }, 200, PUBLIC_NO_STORE);
}
