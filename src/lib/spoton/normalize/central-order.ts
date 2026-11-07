import { sanitizeOrderAllowlist } from "@/lib/spoton/sanitize";
import { moneyToCents, parseQuantity, sumCents } from "@/lib/spoton/money";
import type {
  NormalizedAdjustment,
  NormalizedOrder,
  NormalizedOrderItem,
  NormalizedPayment,
} from "@/lib/spoton/types";
import { DEFAULT_VENUE_TIMEZONE } from "@/lib/constants";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeLineItem(raw: unknown, voided: boolean): NormalizedOrderItem | null {
  const item = asRecord(raw);
  if (!item) return null;
  const voidMeta = asRecord(item.void);
  const isVoided = voided || Boolean(voidMeta);
  const gross = moneyToCents(item.gross_sales_amount ?? item.price);
  const net = moneyToCents(item.net_sales_amount ?? item.gross_sales_amount ?? item.price);
  const tax =
    moneyToCents(item.exclusive_taxes_amount) + moneyToCents(item.inclusive_taxes_amount);
  let modifierNet = 0;
  let modifierTax = 0;
  for (const modRaw of asArray(item.modifiers)) {
    const mod = asRecord(modRaw);
    if (!mod) continue;
    modifierNet += moneyToCents(mod.net_sales_amount ?? mod.price);
    modifierTax +=
      moneyToCents(mod.exclusive_taxes_amount) + moneyToCents(mod.inclusive_taxes_amount);
  }
  return {
    externalItemId: str(item.id),
    externalLineId: str(item.order_item_id),
    name: str(item.name) ?? "Item",
    quantity: parseQuantity(item.quantity ?? 1),
    voided: isVoided,
    giftCardIssueReload: false,
    reportingCategoryId: str(item.reporting_category_id),
    reportingCategoryName: str(item.reporting_category_name),
    parentReportingCategoryId: str(item.parent_reporting_category_id),
    parentReportingCategoryName: str(item.parent_reporting_category_name),
    itemCreatedAt: null,
    preDiscountsCents: gross,
    discountsCents: Math.max(0, gross - net),
    postDiscountsCents: net,
    taxCents: tax + modifierTax,
    totalCents: net + tax,
    netSalesCents: isVoided ? 0 : net + modifierNet,
  };
}

export function normalizeCentralOrder(
  order: Record<string, unknown>,
  options?: { timezone?: string },
): NormalizedOrder {
  const externalOrderId = str(order.id);
  if (!externalOrderId) throw new Error("Central order missing id");

  const items: NormalizedOrderItem[] = [];
  for (const line of asArray(order.line_items)) {
    const normalized = normalizeLineItem(line, false);
    if (normalized) items.push(normalized);
  }
  for (const line of asArray(order.voided_line_items)) {
    const normalized = normalizeLineItem(line, true);
    if (normalized) items.push(normalized);
  }
  for (const checkRaw of asArray(order.checks)) {
    const check = asRecord(checkRaw);
    if (!check) continue;
    for (const guestRaw of asArray(check.guests)) {
      const guest = asRecord(guestRaw);
      if (!guest) continue;
      for (const line of asArray(guest.items)) {
        const normalized = normalizeLineItem(line, false);
        if (normalized) items.push(normalized);
      }
      for (const line of asArray(guest.void_items)) {
        const normalized = normalizeLineItem(line, true);
        if (normalized) items.push(normalized);
      }
    }
  }

  const adjustments: NormalizedAdjustment[] = [];
  for (const discountRaw of asArray(order.discounts)) {
    const discount = asRecord(discountRaw);
    if (!discount) continue;
    adjustments.push({
      kind: "discount",
      externalId: str(discount.id) ?? str(discount.order_discount_id),
      name: str(discount.name),
      amountCents: moneyToCents(discount.amount),
    });
  }
  for (const taxRaw of asArray(order.taxes)) {
    const tax = asRecord(taxRaw);
    if (!tax) continue;
    adjustments.push({
      kind: "tax",
      externalId: str(tax.id),
      name: str(tax.name),
      amountCents: moneyToCents(tax.amount),
    });
  }
  for (const feeRaw of asArray(order.fees)) {
    const fee = asRecord(feeRaw);
    if (!fee) continue;
    adjustments.push({
      kind: "fee",
      externalId: str(fee.id) ?? str(fee.order_fee_id),
      name: str(fee.name),
      amountCents: moneyToCents(fee.amount),
    });
  }

  let liabilityCents = 0;
  for (const liabilityRaw of asArray(order.liabilities)) {
    const liability = asRecord(liabilityRaw);
    if (!liability) continue;
    const amount = moneyToCents(liability.amount);
    liabilityCents += amount;
    adjustments.push({
      kind: "liability",
      externalId: str(liability.id),
      name: str(liability.name),
      amountCents: amount,
    });
  }

  const payments: NormalizedPayment[] = [];
  let tipCents = 0;
  let surchargeCents = 0;
  for (const paymentRaw of asArray(order.payments)) {
    const payment = asRecord(paymentRaw);
    if (!payment) continue;
    const tip = moneyToCents(payment.tip_amount ?? payment.tip);
    tipCents += tip;
    let paySurcharge = 0;
    for (const s of asArray(payment.surcharges)) {
      const surcharge = asRecord(s);
      if (!surcharge) continue;
      const amt = moneyToCents(surcharge.amount);
      paySurcharge += amt;
      adjustments.push({
        kind: "surcharge",
        externalId: str(surcharge.id),
        name: str(surcharge.name),
        amountCents: amt,
      });
    }
    surchargeCents += paySurcharge;
    payments.push({
      externalPaymentOptionId: str(payment.id) ?? str(payment.payment_id),
      paymentName: str(payment.name) ?? str(payment.payment_type),
      amountCents: moneyToCents(payment.amount),
      tipCents: tip,
      tipDeductionCents: 0,
      surchargeCents: paySurcharge,
      paidAt: str(payment.created_at) ?? str(payment.paid_at),
      cardType: str(payment.card_type),
      cardLast4: null,
    });
  }

  const totals = asRecord(order.totals);
  const grossSalesCents = totals
    ? moneyToCents(totals.gross_sales_amount ?? totals.gross_sales)
    : sumCents(items.filter((i) => !i.voided).map((i) => i.preDiscountsCents));
  const discountsCents = totals
    ? moneyToCents(totals.discounts_amount ?? totals.discounts)
    : sumCents(items.filter((i) => !i.voided).map((i) => i.discountsCents));
  const netSalesCents = totals
    ? moneyToCents(totals.net_sales_amount ?? totals.net_sales)
    : sumCents(items.filter((i) => !i.voided).map((i) => i.netSalesCents));
  const taxCents = totals
    ? moneyToCents(totals.tax_amount ?? totals.taxes)
    : sumCents(items.map((i) => i.taxCents));
  const totalCents = totals
    ? moneyToCents(totals.total_amount ?? totals.total)
    : netSalesCents + taxCents + tipCents + surchargeCents;
  const refundsCents = totals ? moneyToCents(totals.refunds_amount ?? totals.refunds) : 0;

  return {
    apiProduct: "central_api",
    locationId: str(order.location_id) ?? "",
    externalOrderId,
    orderNumber: str(order.order_number),
    orderName: null,
    orderTypeName: str(order.order_type),
    orderStatus: str(order.order_status),
    deleted: false,
    scheduled: Boolean(order.released_at === null && order.open_daypart),
    giftCardOrLiability: liabilityCents > 0,
    businessDate: str(order.fiscal_date),
    fiscalDate: str(order.fiscal_date),
    timezone: str(order.order_time_zone) ?? options?.timezone ?? DEFAULT_VENUE_TIMEZONE,
    openedAt: str(order.created_at),
    closedAt: str(order.closed_at),
    releasedAt: str(order.released_at),
    sourceUpdatedAt: str(order.last_updated_at),
    sourceVersion: str(order.last_updated_at),
    attributionBasis: "order_timestamps",
    guestCount: typeof order.guest_count === "number" ? order.guest_count : null,
    tableNumber: str(order.table_number),
    grossSalesCents,
    discountsCents,
    refundsCents,
    netSalesCents: Math.max(0, netSalesCents - liabilityCents),
    taxCents,
    tipCents,
    surchargeCents,
    totalCents,
    liabilityCents,
    isCompleteSnapshot: true,
    rawAllowlist: sanitizeOrderAllowlist(order),
    items,
    adjustments,
    payments,
  };
}
