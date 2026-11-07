import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { DEFAULT_VENUE_TIMEZONE, FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { getCronSecret } from "@/lib/env";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { processWebhookInboxBatch } from "@/lib/spoton/jobs/webhook-processor";
import { runIncrementalOrderSync, syncOrdersWindow } from "@/lib/spoton/sync/orders";
import { syncCentralMenus } from "@/lib/spoton/sync/menus";
import { getSpotOnCentralCredentials } from "@/lib/spoton/credentials";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = getCronSecret();
  const header = request.headers.get("authorization");
  if (secret && header === `Bearer ${secret}`) return true;
  if (request.headers.get("x-vercel-cron") === "1") return true;
  return false;
}

/**
 * Durable SpotOn worker (every 5 minutes via Vercel Cron):
 * 1) Process webhook inbox leases
 * 2) Incremental order sync (Export: 5-min lag windows per docs)
 * 3) Once around 04:00 America/Chicago, reconcile last 26h for replication lag
 * 4) Drain queued menu_sync runs
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Service role is not configured." }, { status: 503 });
  }

  const venueId = FLO_BAMA_VENUE_ID;
  const chicago = DateTime.now().setZone(DEFAULT_VENUE_TIMEZONE);
  const reconcile = chicago.hour === 4 && chicago.minute < 5;

  try {
    const webhook = await processWebhookInboxBatch({ admin, venueId, limit: 40 });

    const { data: queuedMenus } = await admin
      .from("spoton_sync_runs")
      .select("id")
      .eq("venue_id", venueId)
      .eq("kind", "menu_sync")
      .eq("status", "queued")
      .limit(1);
    let menuSync: { menus: number; items: number } | null = null;
    if ((queuedMenus?.length ?? 0) > 0 && getSpotOnCentralCredentials()) {
      menuSync = await syncCentralMenus({ admin, venueId });
    }

    let orders: unknown = null;
    if (reconcile) {
      const { data: settings } = await admin
        .from("spoton_settings")
        .select("api_product, sync_enabled")
        .eq("venue_id", venueId)
        .maybeSingle();
      if (settings?.sync_enabled && settings.api_product !== "none") {
        const now = new Date();
        const start = new Date(now.getTime() - 26 * 60 * 60 * 1000);
        orders = await syncOrdersWindow({
          admin,
          venueId,
          apiProduct: settings.api_product,
          windowStart: start,
          windowEnd: now,
          kind: "reconcile_orders",
        });
      }
    } else {
      orders = await runIncrementalOrderSync({ admin, venueId });
    }

    return NextResponse.json({ ok: true, webhook, orders, menuSync, reconcile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SpotOn cron failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
