import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { publicJson, publicOptions } from "@/lib/public/http";
import { parseLimit, parsePublicRange } from "@/lib/public/listings";
import { listPublicEvents } from "@/lib/public/queries";
import { createAnonSupabaseClient } from "@/lib/supabase/anon";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return publicOptions();
}

export async function GET(request: Request) {
  const client = createAnonSupabaseClient();
  if (!client) {
    return publicJson({ error: "Public listings are not configured." }, 503);
  }

  const url = new URL(request.url);
  const upcoming = url.searchParams.get("upcoming") !== "0" && !url.searchParams.get("from");
  const range = parsePublicRange(url.searchParams.get("from"), url.searchParams.get("to"), upcoming);
  const limit = parseLimit(url.searchParams.get("limit"));
  const { events, error } = await listPublicEvents(client, {
    venueId: FLO_BAMA_VENUE_ID,
    fromIso: range.fromIso,
    toIso: range.toIso,
    limit,
    upcomingByEnd: !url.searchParams.get("from"),
  });
  if (error) return publicJson({ error }, 500);
  return publicJson({ events, count: events.length });
}
