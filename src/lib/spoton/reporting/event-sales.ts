import { DateTime } from "luxon";
import { DEFAULT_VENUE_TIMEZONE } from "@/lib/constants";
import type { SpotOnReportingBucket } from "@/lib/spoton/types";
import { mapCategoryToBucket, type CategoryTotal } from "@/lib/spoton/reporting/metrics";

/**
 * Sales during entertainment events.
 * Label as "sales during the event" — does not prove the band caused the sales.
 * Revenue minus booking fee must NOT be labeled profit.
 *
 * Attribution:
 * - Prefer item_created_at when present (tabs spanning dinner + late show).
 * - Else fall back to order opened_at/closed_at and surface the limitation.
 * - Missing event end time → do not guess; flag incomplete window.
 * - Overlapping windows → flag ambiguous attribution; combined summaries avoid double-count.
 */

export type EventWindowInput = {
  eventId: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  bookingCostCents: number | null;
  overrideStartAt?: string | null;
  overrideEndAt?: string | null;
  preMinutes?: number;
  postMinutes?: number;
  timeZone?: string;
};

export type EventWindow = {
  eventId: string;
  title: string;
  windowStartAt: string;
  windowEndAt: string | null;
  windowComplete: boolean;
  bookingCostCents: number | null;
  overlapsEventIds: string[];
};

export type AttributableItem = {
  orderId: string;
  itemId: string;
  netSalesCents: number;
  categoryName: string | null;
  attributedAt: string;
  attributionBasis: "item_timestamps" | "order_timestamps" | "unknown";
};

export type EventSalesResult = {
  eventId: string;
  title: string;
  windowStartAt: string;
  windowEndAt: string | null;
  windowComplete: boolean;
  attributionBasis: "item_timestamps" | "order_timestamps" | "mixed" | "unknown";
  attributionLimitation: string | null;
  netSalesCents: number;
  orderCount: number;
  categoryTotals: CategoryTotal[];
  bookingCostCents: number | null;
  bookingCostMissing: boolean;
  /** Net sales minus booking fee when fee recorded — NOT labeled profit. */
  netSalesMinusBookingFeeCents: number | null;
  overlapsEventIds: string[];
  ambiguous: boolean;
};

export function resolveEventWindow(input: EventWindowInput): EventWindow {
  const zone = input.timeZone ?? DEFAULT_VENUE_TIMEZONE;
  const pre = input.preMinutes ?? 0;
  const post = input.postMinutes ?? 0;

  const start = input.overrideStartAt
    ? DateTime.fromISO(input.overrideStartAt, { zone: "utc" })
    : DateTime.fromISO(input.startsAt, { zone: "utc" }).minus({ minutes: pre });

  let end: DateTime | null = null;
  let windowComplete = true;
  if (input.overrideEndAt) {
    end = DateTime.fromISO(input.overrideEndAt, { zone: "utc" });
  } else if (input.endsAt) {
    end = DateTime.fromISO(input.endsAt, { zone: "utc" }).plus({ minutes: post });
  } else {
    windowComplete = false;
  }

  if (!start.isValid) {
    throw new Error(`Invalid event start for ${input.eventId}`);
  }
  if (end && !end.isValid) {
    throw new Error(`Invalid event end for ${input.eventId}`);
  }

  return {
    eventId: input.eventId,
    title: input.title,
    windowStartAt: start.toUTC().toISO()!,
    windowEndAt: end ? end.toUTC().toISO()! : null,
    windowComplete,
    bookingCostCents: input.bookingCostCents,
    overlapsEventIds: [],
  };
}

export function detectOverlappingWindows(windows: EventWindow[]): EventWindow[] {
  return windows.map((window) => {
    if (!window.windowEndAt) return { ...window, overlapsEventIds: [] };
    const overlaps = windows
      .filter((other) => other.eventId !== window.eventId && other.windowEndAt)
      .filter((other) => {
        const aStart = Date.parse(window.windowStartAt);
        const aEnd = Date.parse(window.windowEndAt!);
        const bStart = Date.parse(other.windowStartAt);
        const bEnd = Date.parse(other.windowEndAt!);
        return aStart < bEnd && bStart < aEnd;
      })
      .map((other) => other.eventId);
    return { ...window, overlapsEventIds: overlaps };
  });
}

export function attributeItemsToEvent(input: {
  window: EventWindow;
  items: AttributableItem[];
  categoryMappings: Map<string, SpotOnReportingBucket>;
}): EventSalesResult {
  const inWindow: AttributableItem[] = [];
  for (const item of input.items) {
    const ts = Date.parse(item.attributedAt);
    if (!Number.isFinite(ts)) continue;
    if (ts < Date.parse(input.window.windowStartAt)) continue;
    if (input.window.windowEndAt && ts >= Date.parse(input.window.windowEndAt)) continue;
    if (!input.window.windowEndAt) {
      // Incomplete window: include items after start but flag incompleteness.
      inWindow.push(item);
      continue;
    }
    inWindow.push(item);
  }

  const bases = new Set(inWindow.map((i) => i.attributionBasis));
  let attributionBasis: EventSalesResult["attributionBasis"] = "unknown";
  if (bases.size === 1) attributionBasis = [...bases][0]!;
  else if (bases.size > 1) attributionBasis = "mixed";

  const orderIds = new Set(inWindow.map((i) => i.orderId));
  const bucketMap = new Map<SpotOnReportingBucket, { net: number; count: number }>();
  for (const item of inWindow) {
    const bucket = mapCategoryToBucket(item.categoryName, input.categoryMappings);
    const current = bucketMap.get(bucket) ?? { net: 0, count: 0 };
    current.net += item.netSalesCents;
    current.count += 1;
    bucketMap.set(bucket, current);
  }

  const netSalesCents = inWindow.reduce((sum, item) => sum + item.netSalesCents, 0);
  const bookingCostMissing = input.window.bookingCostCents == null;
  const netSalesMinusBookingFeeCents = bookingCostMissing
    ? null
    : netSalesCents - (input.window.bookingCostCents ?? 0);

  let attributionLimitation: string | null = null;
  if (!input.window.windowComplete) {
    attributionLimitation = "Event has no end time; window is open-ended and not guessed.";
  } else if (attributionBasis === "order_timestamps" || attributionBasis === "unknown") {
    attributionLimitation =
      "Item timestamps unavailable; order-level timestamps may assign a cross-show tab to the wrong performance.";
  } else if (input.window.overlapsEventIds.length) {
    attributionLimitation = "Overlapping event windows — some sales may be ambiguous.";
  }

  return {
    eventId: input.window.eventId,
    title: input.window.title,
    windowStartAt: input.window.windowStartAt,
    windowEndAt: input.window.windowEndAt,
    windowComplete: input.window.windowComplete,
    attributionBasis,
    attributionLimitation,
    netSalesCents,
    orderCount: orderIds.size,
    categoryTotals: (["food", "alcohol", "other", "unmapped"] as SpotOnReportingBucket[]).map(
      (bucket) => ({
        bucket,
        netSalesCents: bucketMap.get(bucket)?.net ?? 0,
        itemCount: bucketMap.get(bucket)?.count ?? 0,
      }),
    ),
    bookingCostCents: input.window.bookingCostCents,
    bookingCostMissing,
    netSalesMinusBookingFeeCents,
    overlapsEventIds: input.window.overlapsEventIds,
    ambiguous: input.window.overlapsEventIds.length > 0,
  };
}

/** Combined summary across events without double-counting shared items. */
export function combineEventSalesWithoutDoubleCount(
  results: EventSalesResult[],
  itemsByEvent: Map<string, AttributableItem[]>,
): { uniqueNetSalesCents: number; unassignedNote: string } {
  const seenItemIds = new Set<string>();
  let uniqueNet = 0;
  for (const result of results) {
    const items = itemsByEvent.get(result.eventId) ?? [];
    for (const item of items) {
      if (seenItemIds.has(item.itemId)) continue;
      seenItemIds.add(item.itemId);
      uniqueNet += item.netSalesCents;
    }
  }
  return {
    uniqueNetSalesCents: uniqueNet,
    unassignedNote: "Items outside all event windows remain unassigned and are excluded here.",
  };
}
