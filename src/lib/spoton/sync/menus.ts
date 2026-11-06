import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCentralMenuItems, fetchCentralMenus } from "@/lib/spoton/client/central";
import { getSpotOnCentralCredentials } from "@/lib/spoton/credentials";

/**
 * Menu sync uses Central API Menu endpoints when the account has menu:all:read.
 * Restaurant Export menu catalogs are a separate product surface and are not
 * assumed here. Availability/86 is not a full inventory ledger.
 */
export async function syncCentralMenus(input: {
  admin: SupabaseClient;
  venueId: string;
  requestedBy?: string | null;
}): Promise<{ menus: number; items: number }> {
  const creds = getSpotOnCentralCredentials();
  if (!creds) throw new Error("Central API credentials required for menu sync");

  const run = await input.admin
    .from("spoton_sync_runs")
    .insert({
      venue_id: input.venueId,
      kind: "menu_sync",
      api_product: "central_api",
      status: "running",
      requested_by: input.requestedBy ?? null,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (run.error) throw new Error(run.error.message);

  try {
    const menusResponse = (await fetchCentralMenus({ credentials: creds })) as {
      menus?: Array<Record<string, unknown>>;
    };
    const menus = Array.isArray(menusResponse.menus) ? menusResponse.menus : [];
    let itemCount = 0;

    for (const menu of menus) {
      const menuId = typeof menu.id === "string" ? menu.id : null;
      if (!menuId) continue;
      let page = 1;
      for (;;) {
        const itemsResponse = (await fetchCentralMenuItems({
          menuId,
          credentials: creds,
          page,
        })) as { items?: Array<Record<string, unknown>>; pagination?: { total_pages?: number } };
        const items = Array.isArray(itemsResponse.items) ? itemsResponse.items : [];
        for (const item of items) {
          const externalItemId = typeof item.id === "string" ? item.id : null;
          if (!externalItemId) continue;
          const name = typeof item.name === "string" ? item.name : "Item";
          const description = typeof item.description === "string" ? item.description : null;
          const upsert = await input.admin.from("spoton_menu_items").upsert(
            {
              venue_id: input.venueId,
              api_product: "central_api",
              location_id: creds.locationId,
              external_item_id: externalItemId,
              menu_id: menuId,
              name,
              description,
              available: typeof item.available === "boolean" ? item.available : null,
              availability_known: typeof item.available === "boolean",
              availability_updated_at:
                typeof item.available === "boolean" ? new Date().toISOString() : null,
              source_updated_at: new Date().toISOString(),
              raw_allowlist: {
                id: item.id,
                name: item.name,
                available: item.available,
                menu_id: menuId,
              },
            },
            { onConflict: "venue_id,api_product,external_item_id" },
          );
          if (upsert.error) throw new Error(upsert.error.message);
          itemCount += 1;
        }
        const totalPages = itemsResponse.pagination?.total_pages ?? page;
        if (page >= totalPages || items.length === 0) break;
        page += 1;
        if (page > 200) break;
      }
    }

    await input.admin
      .from("spoton_sync_runs")
      .update({
        status: "succeeded",
        finished_at: new Date().toISOString(),
        details: { menus: menus.length, items: itemCount },
      })
      .eq("id", run.data.id);

    await input.admin
      .from("spoton_settings")
      .update({ menu_status: "verified" })
      .eq("venue_id", input.venueId);

    return { menus: menus.length, items: itemCount };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Menu sync failed";
    await input.admin
      .from("spoton_sync_runs")
      .update({
        status: "failed",
        error_safe: message.slice(0, 500),
        finished_at: new Date().toISOString(),
      })
      .eq("id", run.data.id);
    throw error;
  }
}
