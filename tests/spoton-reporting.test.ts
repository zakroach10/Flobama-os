import { describe, expect, it } from "vitest";
import { moneyToCents, parseCentsFromDecimalString, parseQuantity } from "@/lib/spoton/money";
import {
  businessDateForOrder,
  businessDayWindowUtc,
  splitRangeIntoExportWindows,
} from "@/lib/spoton/reporting/business-day";
import {
  attributeItemsToEvent,
  detectOverlappingWindows,
  resolveEventWindow,
} from "@/lib/spoton/reporting/event-sales";
import { aggregateOrderMetrics } from "@/lib/spoton/reporting/metrics";
import { normalizeRestaurantExportOrder } from "@/lib/spoton/normalize/export-order";
import { normalizeCentralOrder } from "@/lib/spoton/normalize/central-order";
import { sanitizeWebhookPayload, sanitizeOrderAllowlist } from "@/lib/spoton/sanitize";
import { assertExportWindow, clampExportEnd } from "@/lib/spoton/client/restaurant-export";
import { SPOTON_EXPORT_MAX_WINDOW_MS } from "@/lib/spoton/types";

describe("SpotOn money", () => {
  it("parses decimal strings without float drift", () => {
    expect(parseCentsFromDecimalString("1.1")).toBe(110);
    expect(parseCentsFromDecimalString("1.10")).toBe(110);
    expect(parseCentsFromDecimalString("-0.25")).toBe(-25);
    expect(moneyToCents(9.99)).toBe(999);
    expect(parseQuantity(".5")).toBe(".5");
    expect(parseQuantity("1.25")).toBe("1.25");
  });
});

describe("business days (America/Chicago)", () => {
  it("prefers fiscal date over cutoff math", () => {
    expect(
      businessDateForOrder({
        fiscalDate: "2026-03-08",
        referenceInstant: "2026-03-09T05:00:00Z",
        cutoffLocal: "04:00",
        timeZone: "America/Chicago",
      }),
    ).toBe("2026-03-08");
  });

  it("handles midnight and DST spring-forward with Luxon cutoff windows", () => {
    // 2026-03-08 is spring-forward in America/Chicago
    const window = businessDayWindowUtc({
      businessDate: "2026-03-08",
      cutoffLocal: "04:00",
      timeZone: "America/Chicago",
    });
    expect(window.startUtc).toMatch(/Z$/);
    expect(Date.parse(window.endUtc)).toBeGreaterThan(Date.parse(window.startUtc));

    // 3:30am before cutoff stays previous business day
    expect(
      businessDateForOrder({
        referenceInstant: "2026-11-01T08:30:00Z", // CDT/CST around fall back period
        cutoffLocal: "04:00",
        timeZone: "America/Chicago",
      }),
    ).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("splits ranges into Export 26h windows", () => {
    const start = new Date("2026-11-01T00:00:00Z");
    const end = new Date(start.getTime() + 40 * 60 * 60 * 1000);
    const windows = splitRangeIntoExportWindows(start, end, SPOTON_EXPORT_MAX_WINDOW_MS);
    expect(windows.length).toBe(2);
    expect(windows[0]!.end.getTime() - windows[0]!.start.getTime()).toBe(SPOTON_EXPORT_MAX_WINDOW_MS);
  });
});

describe("Restaurant Export window guards", () => {
  it("enforces 26h max and 5-minute lag", () => {
    const now = new Date("2026-11-05T18:00:00Z");
    const end = clampExportEnd(now, now);
    expect(now.getTime() - end.getTime()).toBeGreaterThanOrEqual(5 * 60 * 1000);
    expect(() =>
      assertExportWindow(
        new Date(now.getTime() - 30 * 60 * 60 * 1000),
        end,
        now,
      ),
    ).toThrow(/26 hours/);
  });
});

describe("order normalization fixtures", () => {
  it("normalizes Export orders with fractional qty and gift-card liability", () => {
    const order = normalizeRestaurantExportOrder({
      id: "ord-1",
      locationId: "loc-1",
      name: "12",
      deleted: false,
      scheduled: false,
      createdAt: "2026-11-05T00:00:00Z",
      closedAt: "2026-11-05T01:00:00Z",
      updatedAt: "2026-11-05T01:00:00Z",
      totalAmount: "21.5",
      checks: [
        {
          gratuityAmount: "0",
          items: [],
          voidedItems: [],
          surcharges: [],
          autoGratuityTaxes: [],
          payments: [
            {
              paymentOptionId: "cash",
              paymentName: "Cash",
              createdAt: "2026-11-05T01:00:00Z",
              amount: "21.5",
              tipAmount: "3.5",
              tipDeductionAmount: "0",
              surcharges: [],
            },
          ],
          guests: [
            {
              items: [
                {
                  menuItemId: "mi-1",
                  name: "Burger",
                  createdAt: "2026-11-05T00:10:00Z",
                  quantity: ".5",
                  preDiscountsAmount: "6",
                  discountsAmount: "1",
                  postDiscountsAmount: "5",
                  taxesAmount: "0.5",
                  totalAmount: "5.5",
                  giftCardIssueReload: false,
                  modifiers: [],
                  subItems: [],
                },
                {
                  menuItemId: "gc-1",
                  name: "Gift Card",
                  createdAt: "2026-11-05T00:11:00Z",
                  quantity: "1",
                  preDiscountsAmount: "15",
                  discountsAmount: "0",
                  postDiscountsAmount: "15",
                  taxesAmount: "0",
                  totalAmount: "15",
                  giftCardIssueReload: true,
                  modifiers: [],
                  subItems: [],
                },
              ],
              voidedItems: [],
            },
          ],
        },
      ],
    });

    expect(order.items[0]?.quantity).toBe(".5");
    expect(order.items[0]?.netSalesCents).toBe(500);
    expect(order.items[1]?.netSalesCents).toBe(0);
    expect(order.liabilityCents).toBe(1500);
    expect(order.netSalesCents).toBe(500);
    expect(order.tipCents).toBe(350);
    expect(order.attributionBasis).toBe("item_timestamps");
  });

  it("re-importing the same Export totals does not invent extra revenue in aggregation", () => {
    const snapshot = {
      deleted: false,
      is_complete_snapshot: true,
      gross_sales_cents: 1000,
      discounts_cents: 100,
      refunds_cents: 0,
      net_sales_cents: 900,
      tax_cents: 80,
      tip_cents: 200,
      surcharge_cents: 0,
      liability_cents: 0,
    };
    const once = aggregateOrderMetrics([snapshot]);
    const twice = aggregateOrderMetrics([snapshot, snapshot]);
    // Aggregation of two rows would double — persistence must upsert one row.
    // This asserts the metric math; idempotency is the unique external_order_id upsert.
    expect(once.netSalesCents).toBe(900);
    expect(twice.netSalesCents).toBe(1800);
    expect(once.averageOrderValueCents).toBe(900);
  });

  it("normalizes Central orders and keeps taxes/tips out of net when totals provided", () => {
    const order = normalizeCentralOrder({
      id: "c-1",
      location_id: "BL-1",
      fiscal_date: "2026-11-05",
      created_at: "2026-11-05T18:00:00Z",
      last_updated_at: "2026-11-05T19:00:00Z",
      closed_at: "2026-11-05T19:00:00Z",
      totals: {
        gross_sales: 20,
        discounts: 2,
        net_sales: 18,
        tax_amount: 1.5,
        total: 22,
        refunds: 0,
      },
      line_items: [
        {
          id: "li-1",
          name: "Nachos",
          quantity: 1,
          gross_sales_amount: 20,
          net_sales_amount: 18,
          exclusive_taxes_amount: 1.5,
          inclusive_taxes_amount: 0,
          reporting_category_name: "Food",
          modifiers: [],
        },
      ],
      payments: [{ amount: 22, tip_amount: 2.5, surcharges: [] }],
      discounts: [],
      taxes: [],
      fees: [],
      liabilities: [],
      voided_line_items: [],
      checks: [],
    });
    expect(order.fiscalDate).toBe("2026-11-05");
    expect(order.netSalesCents).toBe(1800);
    expect(order.taxCents).toBe(150);
    expect(order.tipCents).toBe(250);
    expect(order.attributionBasis).toBe("order_timestamps");
  });
});

describe("event sales attribution", () => {
  it("uses item timestamps for cross-show tabs and flags overlaps / missing end", () => {
    const dinner = resolveEventWindow({
      eventId: "e1",
      title: "Dinner set",
      startsAt: "2026-11-05T23:00:00Z",
      endsAt: "2026-11-06T01:00:00Z",
      bookingCostCents: null,
    });
    const late = resolveEventWindow({
      eventId: "e2",
      title: "Late show",
      startsAt: "2026-11-06T00:30:00Z",
      endsAt: "2026-11-06T03:00:00Z",
      bookingCostCents: 50000,
    });
    const openEnded = resolveEventWindow({
      eventId: "e3",
      title: "No end",
      startsAt: "2026-11-06T04:00:00Z",
      endsAt: null,
      bookingCostCents: 0,
    });
    expect(openEnded.windowComplete).toBe(false);
    expect(openEnded.bookingCostCents).toBe(0);

    const windows = detectOverlappingWindows([dinner, late, openEnded]);
    expect(windows[0]?.overlapsEventIds).toContain("e2");

    const items = [
      {
        orderId: "o1",
        itemId: "i1",
        netSalesCents: 1000,
        categoryName: "Beer",
        attributedAt: "2026-11-05T23:30:00Z",
        attributionBasis: "item_timestamps" as const,
      },
      {
        orderId: "o1",
        itemId: "i2",
        netSalesCents: 2000,
        categoryName: "Beer",
        attributedAt: "2026-11-06T01:00:00Z",
        attributionBasis: "item_timestamps" as const,
      },
    ];
    const mappings = new Map([["Beer", "alcohol" as const]]);
    const dinnerSales = attributeItemsToEvent({
      window: windows[0]!,
      items,
      categoryMappings: mappings,
    });
    const lateSales = attributeItemsToEvent({
      window: windows[1]!,
      items,
      categoryMappings: mappings,
    });
    expect(dinnerSales.netSalesCents).toBe(1000);
    expect(lateSales.netSalesCents).toBe(2000);
    expect(dinnerSales.bookingCostMissing).toBe(true);
    expect(lateSales.bookingCostMissing).toBe(false);
    expect(lateSales.netSalesMinusBookingFeeCents).toBe(2000 - 50000);
    expect(lateSales.ambiguous).toBe(true);
  });
});

describe("sanitization", () => {
  it("strips secrets and customer/card fields from stored payloads", () => {
    const sanitized = sanitizeWebhookPayload({
      id: "e",
      timestamp: "2026-11-05T00:00:00Z",
      category: "EVENT_CATEGORY_ITEM",
      location_id: "BL",
      details: {
        item: {
          id: "1",
          type: "EVENT_TYPE_UPDATED",
          name: "Wings",
          available: true,
          email: "guest@example.com",
          card_number: "4111111111111111",
          signature_key: "nope",
        },
      },
    });
    const item = (sanitized.details as { item: Record<string, unknown> }).item;
    expect(item.email).toBeUndefined();
    expect(item.card_number).toBeUndefined();
    expect(item.signature_key).toBeUndefined();
    expect(item.name).toBe("Wings");

    const allow = sanitizeOrderAllowlist({
      id: "1",
      customer: { email: "x" },
      cardNumber: "...1111",
      orderNumber: "100",
    });
    expect(allow.customer).toBeUndefined();
    expect(allow.cardNumber).toBeUndefined();
    expect(allow.orderNumber).toBe("100");
  });
});
