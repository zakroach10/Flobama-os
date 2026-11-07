import type { SpotOnReportingBucket } from "@/lib/spoton/types";

/**
 * Metric definitions (reconcile against source order snapshots):
 *
 * - gross_sales: sum of non-voided item pre-discount extended amounts (excludes tips/taxes)
 * - discounts: sum of non-voided item discount amounts
 * - refunds: order-level refunds_cents (Central) or reopen/void corrections via re-import
 * - net_sales: gross - discounts - refunds - liabilities (gift cards / unreleased scheduled)
 *              Taxes and tips are NOT included in net sales.
 * - taxes: tax_cents on orders (item + surcharge auto-gratuity taxes as stored)
 * - tips: tip_cents (payment tips + check auto-gratuity)
 * - order_count: distinct non-deleted complete closed/paid orders in the period
 * - average_order_value: net_sales / order_count when order_count > 0; else unavailable
 *
 * Voids: voided items contribute 0 to net. Deleted orders contribute 0.
 * Parent/child: modifiers/subitems are stored with their own net; top-level item net
 * excludes nested priced children in Export normalization to avoid double-counting.
 */

export type SalesTotals = {
  grossSalesCents: number;
  discountsCents: number;
  refundsCents: number;
  netSalesCents: number;
  taxCents: number;
  tipCents: number;
  surchargeCents: number;
  liabilityCents: number;
  orderCount: number;
  averageOrderValueCents: number | null;
  partial: boolean;
  coverageThrough: string | null;
  dataAgeLabel: string | null;
};

export type CategoryTotal = {
  bucket: SpotOnReportingBucket;
  netSalesCents: number;
  itemCount: number;
};

export type HourlyBucket = {
  hourLocal: number;
  netSalesCents: number;
  orderCount: number;
};

export function emptySalesTotals(partial = true): SalesTotals {
  return {
    grossSalesCents: 0,
    discountsCents: 0,
    refundsCents: 0,
    netSalesCents: 0,
    taxCents: 0,
    tipCents: 0,
    surchargeCents: 0,
    liabilityCents: 0,
    orderCount: 0,
    averageOrderValueCents: null,
    partial,
    coverageThrough: null,
    dataAgeLabel: null,
  };
}

export type OrderMetricRow = {
  deleted: boolean;
  is_complete_snapshot: boolean;
  gross_sales_cents: number;
  discounts_cents: number;
  refunds_cents: number;
  net_sales_cents: number;
  tax_cents: number;
  tip_cents: number;
  surcharge_cents: number;
  liability_cents: number;
};

export function aggregateOrderMetrics(
  rows: OrderMetricRow[],
  options?: { coverageThrough?: string | null; now?: Date },
): SalesTotals {
  const totals = emptySalesTotals(false);
  for (const row of rows) {
    if (row.deleted) continue;
    if (!row.is_complete_snapshot) {
      totals.partial = true;
      continue;
    }
    totals.grossSalesCents += row.gross_sales_cents;
    totals.discountsCents += row.discounts_cents;
    totals.refundsCents += row.refunds_cents;
    totals.netSalesCents += row.net_sales_cents;
    totals.taxCents += row.tax_cents;
    totals.tipCents += row.tip_cents;
    totals.surchargeCents += row.surcharge_cents;
    totals.liabilityCents += row.liability_cents;
    totals.orderCount += 1;
  }
  totals.averageOrderValueCents =
    totals.orderCount > 0 ? Math.round(totals.netSalesCents / totals.orderCount) : null;
  totals.coverageThrough = options?.coverageThrough ?? null;
  if (options?.coverageThrough) {
    const ageMs = (options.now ?? new Date()).getTime() - Date.parse(options.coverageThrough);
    if (Number.isFinite(ageMs) && ageMs >= 0) {
      const minutes = Math.floor(ageMs / 60_000);
      totals.dataAgeLabel =
        minutes < 60 ? `${minutes}m old` : `${Math.floor(minutes / 60)}h ${minutes % 60}m old`;
    }
  }
  return totals;
}

export function mapCategoryToBucket(
  categoryName: string | null | undefined,
  mappings: Map<string, SpotOnReportingBucket>,
): SpotOnReportingBucket {
  if (!categoryName) return "unmapped";
  return mappings.get(categoryName) ?? mappings.get(categoryName.toLowerCase()) ?? "unmapped";
}

export const METRIC_DOCUMENTATION = [
  {
    key: "gross_sales",
    label: "Gross sales",
    calculation: "Sum of non-voided item pre-discount extended amounts. Excludes taxes and tips.",
  },
  {
    key: "discounts",
    label: "Discounts",
    calculation: "Sum of non-voided item discount amounts from the POS snapshot.",
  },
  {
    key: "refunds",
    label: "Refunds",
    calculation: "Order-level refund amounts when provided by the reporting API; voids zero item net on re-import.",
  },
  {
    key: "net_sales",
    label: "Net sales",
    calculation:
      "Gross − discounts − refunds − liabilities (gift cards / unreleased scheduled). Taxes and tips excluded.",
  },
  {
    key: "taxes",
    label: "Taxes",
    calculation: "Tax amounts from the order snapshot (not included in net sales).",
  },
  {
    key: "tips",
    label: "Tips",
    calculation: "Payment tips plus check auto-gratuity (not included in net sales).",
  },
  {
    key: "order_count",
    label: "Orders",
    calculation: "Count of non-deleted complete order snapshots in the selected period.",
  },
  {
    key: "aov",
    label: "Average order value",
    calculation: "Net sales ÷ order count. Shown as unavailable when order count is zero.",
  },
] as const;
