import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { publicJson, publicOptions } from "@/lib/public/http";
import { getPublicEvent } from "@/lib/public/queries";
import { createAnonSupabaseClient } from "@/lib/supabase/anon";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return publicOptions();
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const client = createAnonSupabaseClient();
  if (!client) {
    return publicJson({ error: "Public listings are not configured." }, 503);
  }
  const { id } = await context.params;
  const { event, error } = await getPublicEvent(client, id, FLO_BAMA_VENUE_ID);
  if (error) return publicJson({ error }, 500);
  if (!event) return publicJson({ error: "Not found." }, 404);
  return publicJson({ event });
}
