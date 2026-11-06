import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchRestaurantExportOrders,
  clampExportEnd,
} from "@/lib/spoton/client/restaurant-export";
import { fetchAllCentralOrders } from "@/lib/spoton/client/central";
import { normalizeRestaurantExportOrder } from "@/lib/spoton/normalize/export-order";
import { normalizeCentralOrder } from "@/lib/spoton/normalize/central-order";
import { upsertNormalizedOrder } from "@/lib/spoton/persist/orders";
import { businessDateForOrder, splitRangeIntoExportWindows } from "@/lib/spoton/reporting/business-day";
import { SPOTON_EXPORT_MAX_WINDOW_MS } from "@/lib/spoton/types";
import { DEFAULT_VENUE_TIMEZONE } from "@/lib/constants";
import type { SpotOnApiProduct } from "@/lib/spoton/types";

export type SyncOrdersResult = {
  upserted: number;
  skipped: number;
  coverageThrough: string | null;
  windows: number;
  errors: string[];
};

async function loadSettings(admin: SupabaseClient, venueId: string) {
  const { data, error } = await admin.from("spoton_settings").select("*").eq("venue_id", venueId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function syncOrdersWindow(input: {
  admin: SupabaseClient;
  venueId: string;
  apiProduct: Exclude<SpotOnApiProduct, "none">;
  windowStart: Date;
  windowEnd: Date;
  kind: "incremental_orders" | "backfill_orders" | "manual_orders" | "reconcile_orders";
  requestedBy?: string | null;
  overlapMs?: number;
}): Promise<SyncOrdersResult> {
  const settings = await loadSettings(input.admin, input.venueId);
  const cutoff = settings?.business_day_cutoff_local?.slice(0, 5) ?? "04:00";
  const timezone = DEFAULT_VENUE_TIMEZONE;
  const overlapMs = input.overlapMs ?? 15 * 60 * 1000;
  const effectiveStart = new Date(input.windowStart.getTime() - overlapMs);
  const now = new Date();

  const runInsert = await input.admin
    .from("spoton_sync_runs")
    .insert({
      venue_id: input.venueId,
      kind: input.kind,
      api_product: input.apiProduct,
      status: "running",
      requested_by: input.requestedBy ?? null,
      window_start: input.windowStart.toISOString(),
      window_end: input.windowEnd.toISOString(),
      checkpoint_before: settings?.coverage_through ?? null,
      started_at: now.toISOString(),
      lease_owner: `sync:${process.pid}`,
      lease_expires_at: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();
  if (runInsert.error) throw new Error(runInsert.error.message);
  const runId = runInsert.data.id;

  const result: SyncOrdersResult = {
    upserted: 0,
    skipped: 0,
    coverageThrough: null,
    windows: 0,
    errors: [],
  };

  try {
    if (input.apiProduct === "restaurant_export") {
      const end = clampExportEnd(input.windowEnd, now);
      const windows = splitRangeIntoExportWindows(effectiveStart, end, SPOTON_EXPORT_MAX_WINDOW_MS);
      result.windows = windows.length;
      for (const window of windows) {
        const orders = await fetchRestaurantExportOrders({
          updatedAtStart: window.start,
          updatedAtEnd: window.end,
          now,
        });
        for (const raw of orders) {
          try {
            const normalized = normalizeRestaurantExportOrder(raw, { timezone });
            const businessDate = businessDateForOrder({
              fiscalDate: normalized.fiscalDate,
              businessDate: normalized.businessDate,
              referenceInstant: normalized.closedAt ?? normalized.openedAt,
              cutoffLocal: cutoff,
              timeZone: timezone,
            });
            normalized.businessDate = businessDate;
            const outcome = await upsertNormalizedOrder(input.admin, input.venueId, normalized);
            if (outcome === "inserted" || outcome === "updated") result.upserted += 1;
            else result.skipped += 1;
          } catch (error) {
            result.errors.push(error instanceof Error ? error.message : "normalize failed");
          }
        }
      }
      result.coverageThrough = end.toISOString();
    } else {
      const orders = await fetchAllCentralOrders({
        lastUpdatedFrom: effectiveStart,
        lastUpdatedTo: input.windowEnd,
      });
      result.windows = 1;
      for (const raw of orders) {
        try {
          const normalized = normalizeCentralOrder(raw, { timezone });
          const businessDate = businessDateForOrder({
            fiscalDate: normalized.fiscalDate,
            businessDate: normalized.businessDate,
            referenceInstant: normalized.closedAt ?? normalized.openedAt,
            cutoffLocal: cutoff,
            timeZone: timezone,
          });
          normalized.businessDate = businessDate;
          const outcome = await upsertNormalizedOrder(input.admin, input.venueId, normalized);
          if (outcome === "inserted" || outcome === "updated") result.upserted += 1;
          else result.skipped += 1;
        } catch (error) {
          result.errors.push(error instanceof Error ? error.message : "normalize failed");
        }
      }
      result.coverageThrough = input.windowEnd.toISOString();
    }

    // Advance checkpoint only after the full requested window committed.
    const finishedAt = new Date().toISOString();
    await input.admin
      .from("spoton_sync_runs")
      .update({
        status: result.errors.length ? "failed" : "succeeded",
        orders_upserted: result.upserted,
        orders_skipped: result.skipped,
        coverage_through: result.coverageThrough,
        checkpoint_after: result.coverageThrough,
        error_safe: result.errors.slice(0, 5).join("; ") || null,
        details: { windows: result.windows, errorCount: result.errors.length },
        finished_at: finishedAt,
        lease_owner: null,
        lease_expires_at: null,
      })
      .eq("id", runId);

    if (!result.errors.length && result.coverageThrough) {
      await input.admin
        .from("spoton_settings")
        .update({
          last_successful_sync_at: finishedAt,
          coverage_through: result.coverageThrough,
          reporting_status: "verified",
        })
        .eq("venue_id", input.venueId);
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    await input.admin
      .from("spoton_sync_runs")
      .update({
        status: "failed",
        error_safe: message.slice(0, 500),
        finished_at: new Date().toISOString(),
        lease_owner: null,
        lease_expires_at: null,
      })
      .eq("id", runId);
    throw error;
  }
}

export async function runIncrementalOrderSync(input: {
  admin: SupabaseClient;
  venueId: string;
}): Promise<SyncOrdersResult | { skipped: true; reason: string }> {
  const settings = await loadSettings(input.admin, input.venueId);
  if (!settings) return { skipped: true, reason: "SpotOn settings missing" };
  if (!settings.sync_enabled) return { skipped: true, reason: "Sync disabled" };
  if (settings.api_product === "none") return { skipped: true, reason: "No API product selected" };
  if (settings.reporting_status === "not_configured") {
    return { skipped: true, reason: "Reporting not configured" };
  }

  const now = new Date();
  const coverage = settings.coverage_through ? new Date(settings.coverage_through) : null;
  // Overlapping retrieval: look back up to 2h from last coverage, or last 6h on first run.
  const windowEnd = now;
  const windowStart = coverage
    ? new Date(Math.max(coverage.getTime() - 2 * 60 * 60 * 1000, now.getTime() - 26 * 60 * 60 * 1000))
    : new Date(now.getTime() - 6 * 60 * 60 * 1000);

  return syncOrdersWindow({
    admin: input.admin,
    venueId: input.venueId,
    apiProduct: settings.api_product,
    windowStart,
    windowEnd,
    kind: "incremental_orders",
  });
}
