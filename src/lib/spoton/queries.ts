import type { SupabaseClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";
import { DEFAULT_VENUE_TIMEZONE } from "@/lib/constants";
import {
  aggregateOrderMetrics,
  mapCategoryToBucket,
  type CategoryTotal,
  type HourlyBucket,
  type SalesTotals,
} from "@/lib/spoton/reporting/metrics";
import {
  attributeItemsToEvent,
  detectOverlappingWindows,
  resolveEventWindow,
  type EventSalesResult,
} from "@/lib/spoton/reporting/event-sales";
import type { SpotOnReportingBucket } from "@/lib/spoton/types";
import { businessDayWindowUtc } from "@/lib/spoton/reporting/business-day";

export async function loadSalesDashboard(input: {
  client: SupabaseClient;
  venueId: string;
  businessDate?: string;
  compareBusinessDate?: string;
  cutoffLocal?: string;
  coverageThrough?: string | null;
  reportingAvailable: boolean;
}) {
  if (!input.reportingAvailable) {
    return {
      available: false as const,
      totals: null,
      compareTotals: null,
      categories: [] as CategoryTotal[],
      hourly: [] as HourlyBucket[],
      businessDate: input.businessDate ?? null,
    };
  }

  const zone = DEFAULT_VENUE_TIMEZONE;
  const businessDate =
    input.businessDate ??
    DateTime.now().setZone(zone).toISODate()!;
  const cutoff = input.cutoffLocal ?? "04:00";
  const window = businessDayWindowUtc({ businessDate, cutoffLocal: cutoff, timeZone: zone });

  const ordersRes = await input.client
    .from("spoton_orders")
    .select(
      "id, deleted, is_complete_snapshot, gross_sales_cents, discounts_cents, refunds_cents, net_sales_cents, tax_cents, tip_cents, surcharge_cents, liability_cents, business_date, opened_at, closed_at",
    )
    .eq("venue_id", input.venueId)
    .or(
      `business_date.eq.${businessDate},and(business_date.is.null,closed_at.gte.${window.startUtc},closed_at.lt.${window.endUtc})`,
    );

  if (ordersRes.error) throw new Error(ordersRes.error.message);
  const orders = ordersRes.data ?? [];
  const totals = aggregateOrderMetrics(orders, {
    coverageThrough: input.coverageThrough,
  });

  const orderIds = orders.filter((o) => !o.deleted).map((o) => o.id);
  const categories: CategoryTotal[] = [];
  const hourlyMap = new Map<number, { net: number; orders: Set<string> }>();

  if (orderIds.length) {
    const mappingsRes = await input.client
      .from("spoton_category_mappings")
      .select("external_category_name, reporting_bucket")
      .eq("venue_id", input.venueId);
    const mapping = new Map<string, SpotOnReportingBucket>();
    for (const row of mappingsRes.data ?? []) {
      mapping.set(row.external_category_name, row.reporting_bucket as SpotOnReportingBucket);
      mapping.set(String(row.external_category_name).toLowerCase(), row.reporting_bucket as SpotOnReportingBucket);
    }

    const itemsRes = await input.client
      .from("spoton_order_items")
      .select(
        "id, order_id, net_sales_cents, reporting_category_name, item_created_at, voided",
      )
      .eq("venue_id", input.venueId)
      .in("order_id", orderIds);
    if (itemsRes.error) throw new Error(itemsRes.error.message);

    const bucketMap = new Map<SpotOnReportingBucket, { net: number; count: number }>();
    for (const item of itemsRes.data ?? []) {
      if (item.voided) continue;
      const bucket = mapCategoryToBucket(item.reporting_category_name, mapping);
      const current = bucketMap.get(bucket) ?? { net: 0, count: 0 };
      current.net += item.net_sales_cents;
      current.count += 1;
      bucketMap.set(bucket, current);

      const ts = item.item_created_at
        ? DateTime.fromISO(item.item_created_at, { zone: "utc" }).setZone(zone)
        : null;
      if (ts?.isValid) {
        const hour = ts.hour;
        const entry = hourlyMap.get(hour) ?? { net: 0, orders: new Set<string>() };
        entry.net += item.net_sales_cents;
        entry.orders.add(item.order_id);
        hourlyMap.set(hour, entry);
      }
    }
    for (const bucket of ["food", "alcohol", "other", "unmapped"] as SpotOnReportingBucket[]) {
      categories.push({
        bucket,
        netSalesCents: bucketMap.get(bucket)?.net ?? 0,
        itemCount: bucketMap.get(bucket)?.count ?? 0,
      });
    }
  }

  const hourly: HourlyBucket[] = Array.from({ length: 24 }, (_, hourLocal) => ({
    hourLocal,
    netSalesCents: hourlyMap.get(hourLocal)?.net ?? 0,
    orderCount: hourlyMap.get(hourLocal)?.orders.size ?? 0,
  }));

  let compareTotals: SalesTotals | null = null;
  if (input.compareBusinessDate) {
    const compareWindow = businessDayWindowUtc({
      businessDate: input.compareBusinessDate,
      cutoffLocal: cutoff,
      timeZone: zone,
    });
    const compareRes = await input.client
      .from("spoton_orders")
      .select(
        "deleted, is_complete_snapshot, gross_sales_cents, discounts_cents, refunds_cents, net_sales_cents, tax_cents, tip_cents, surcharge_cents, liability_cents",
      )
      .eq("venue_id", input.venueId)
      .or(
        `business_date.eq.${input.compareBusinessDate},and(business_date.is.null,closed_at.gte.${compareWindow.startUtc},closed_at.lt.${compareWindow.endUtc})`,
      );
    if (compareRes.error) throw new Error(compareRes.error.message);
    compareTotals = aggregateOrderMetrics(compareRes.data ?? [], {
      coverageThrough: input.coverageThrough,
    });
  }

  return {
    available: true as const,
    totals,
    compareTotals,
    categories,
    hourly,
    businessDate,
  };
}

export async function loadEventSales(input: {
  client: SupabaseClient;
  venueId: string;
  fromIso: string;
  toIso: string;
  preMinutes: number;
  postMinutes: number;
  reportingAvailable: boolean;
}): Promise<EventSalesResult[]> {
  if (!input.reportingAvailable) return [];

  const eventsRes = await input.client
    .from("events")
    .select("id, title, starts_at, ends_at, booking_cost_cents")
    .eq("venue_id", input.venueId)
    .gte("starts_at", input.fromIso)
    .lte("starts_at", input.toIso)
    .order("starts_at", { ascending: true });
  if (eventsRes.error) throw new Error(eventsRes.error.message);

  const windowsRes = await input.client
    .from("spoton_event_windows")
    .select("event_id, window_start_at, window_end_at")
    .eq("venue_id", input.venueId);
  const overrides = new Map(
    (windowsRes.data ?? []).map((row) => [
      row.event_id,
      { start: row.window_start_at as string | null, end: row.window_end_at as string | null },
    ]),
  );

  let windows = (eventsRes.data ?? []).map((event) =>
    resolveEventWindow({
      eventId: event.id,
      title: event.title,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      bookingCostCents: event.booking_cost_cents,
      overrideStartAt: overrides.get(event.id)?.start,
      overrideEndAt: overrides.get(event.id)?.end,
      preMinutes: input.preMinutes,
      postMinutes: input.postMinutes,
    }),
  );
  windows = detectOverlappingWindows(windows);

  const mappingsRes = await input.client
    .from("spoton_category_mappings")
    .select("external_category_name, reporting_bucket")
    .eq("venue_id", input.venueId);
  const mapping = new Map<string, SpotOnReportingBucket>();
  for (const row of mappingsRes.data ?? []) {
    mapping.set(row.external_category_name, row.reporting_bucket as SpotOnReportingBucket);
  }

  const ordersRes = await input.client
    .from("spoton_orders")
    .select("id, opened_at, closed_at, attribution_basis, deleted")
    .eq("venue_id", input.venueId)
    .eq("deleted", false);
  if (ordersRes.error) throw new Error(ordersRes.error.message);
  const orderMap = new Map((ordersRes.data ?? []).map((o) => [o.id, o]));
  const orderIds = [...orderMap.keys()];
  const flatItems =
    orderIds.length === 0
      ? { data: [], error: null }
      : await input.client
          .from("spoton_order_items")
          .select("id, order_id, net_sales_cents, reporting_category_name, item_created_at, voided")
          .eq("venue_id", input.venueId)
          .in("order_id", orderIds);
  if (flatItems.error) throw new Error(flatItems.error.message);

  const attributable = (flatItems.data ?? [])
    .filter((item) => !item.voided)
    .map((item) => {
      const order = orderMap.get(item.order_id);
      const attributedAt = item.item_created_at ?? order?.opened_at ?? order?.closed_at ?? null;
      if (!attributedAt || !order) return null;
      return {
        orderId: item.order_id,
        itemId: item.id,
        netSalesCents: item.net_sales_cents as number,
        categoryName: item.reporting_category_name as string | null,
        attributedAt,
        attributionBasis: (item.item_created_at
          ? "item_timestamps"
          : order.attribution_basis) as "item_timestamps" | "order_timestamps" | "unknown",
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  return windows.map((window) =>
    attributeItemsToEvent({
      window,
      items: attributable,
      categoryMappings: mapping,
    }),
  );
}
