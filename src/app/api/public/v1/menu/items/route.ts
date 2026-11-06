import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { publicJson, publicOptions, PUBLIC_NO_STORE } from "@/lib/public/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Sanitized public menu/availability for explicitly mapped + publishable items.
 * Financial and integration metadata are never exposed.
 * Availability null means unknown/stale — not a full inventory ledger.
 */
export async function GET() {
  const admin = createServiceRoleClient();
  if (!admin) {
    return publicJson({ error: "Service unavailable" }, 503, PUBLIC_NO_STORE);
  }

  const { data: settings } = await admin
    .from("spoton_settings")
    .select("publish_mapped_menu")
    .eq("venue_id", FLO_BAMA_VENUE_ID)
    .maybeSingle();

  if (!settings?.publish_mapped_menu) {
    return publicJson({ items: [], publishEnabled: false }, 200, PUBLIC_NO_STORE);
  }

  const { data, error } = await admin
    .from("spoton_public_menu_items")
    .select(
      "external_item_id, name, description, artwork_url, available, availability_known, availability_updated_at, source_updated_at",
    )
    .eq("venue_id", FLO_BAMA_VENUE_ID)
    .order("name");

  if (error) {
    return publicJson({ error: "Menu query failed" }, 500, PUBLIC_NO_STORE);
  }

  const items = (data ?? []).map((row) => ({
    id: row.external_item_id,
    name: row.name,
    description: row.description,
    artworkUrl: row.artwork_url,
    available: row.availability_known ? row.available : null,
    availabilityKnown: row.availability_known,
    availabilityUpdatedAt: row.availability_updated_at,
    sourceUpdatedAt: row.source_updated_at,
    freshness:
      row.availability_known && row.availability_updated_at ? "confirmed" : "unknown_or_stale",
  }));

  return publicJson({ items, publishEnabled: true }, 200, PUBLIC_NO_STORE);
}

export function OPTIONS() {
  return publicOptions();
}
