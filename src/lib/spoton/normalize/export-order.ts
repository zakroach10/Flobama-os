import { extractCardLast4, sanitizeOrderAllowlist } from "@/lib/spoton/sanitize";
import { moneyToCents, parseQuantity, sumCents } from "@/lib/spoton/money";
import type { NormalizedOrder, NormalizedOrderItem, NormalizedPayment, NormalizedAdjustment } from "@/lib/spoton/types";
import { DEFAULT_VENUE_TIMEZONE } from "@/lib/constants";

/**
 * Normalize Restaurant Export API order objects.
 * Money fields are decimal strings (DOLLARAMOUNT). Item quantities are decimal strings.
 * Gift card issue/reload and unreleased scheduled payments are liabilities, not net sales.
 */

type Dollarish = unknown;

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

function flattenMenuItems(
  items: unknown[],
  voided: boolean,
): Array<Record<string, unknown> & { __voided: boolean }> {
  const out: Array<Record<string, unknown> & { __voided: boolean }> = [];
  for (const entry of items) {
    const item = asRecord(entry);
    if (!item) continue;
    out.push({ ...item, __voided: voided });
    for (const sub of asArray(item.subItems)) {
      const subItem = asRecord(sub);
      if (subItem) out.push({ ...subItem, __voided: voided });
    }
  }
  return out;
}

function collectItemsFromOrder(order: Record<string, unknown>): Array<Record<string, unknown> & { __voided: boolean }> {
  const collected: Array<Record<string, unknown> & { __voided: boolean }> = [];
  for (const checkRaw of asArray(order.checks)) {
    const check = asRecord(checkRaw);
    if (!check) continue;
    collected.push(...flattenMenuItems(asArray(check.items), false));
    collected.push(...flattenMenuItems(asArray(check.voidedItems), true));
    for (const guestRaw of asArray(check.guests)) {
      const guest = asRecord(guestRaw);
      if (!guest) continue;
      collected.push(...flattenMenuItems(asArray(guest.items), false));
      collected.push(...flattenMenuItems(asArray(guest.voidedItems), true));
    }
  }
  return collected;
}

function itemToNormalized(item: Record<string, unknown> & { __voided: boolean }): NormalizedOrderItem {
  const giftCard = Boolean(item.giftCardIssueReload);
  const pre = moneyToCents(item.preDiscountsAmount as Dollarish);
  const discounts = moneyToCents(item.discountsAmount as Dollarish);
  const post = moneyToCents(item.postDiscountsAmount as Dollarish);
  const tax = moneyToCents(item.taxesAmount as Dollarish);
  const total = moneyToCents(item.totalAmount as Dollarish);
  // Modifiers contribute separately when priced; include their post-discount into net when present.
  let modifierNet = 0;
  let modifierTax = 0;
  for (const modRaw of asArray(item.modifiers)) {
    const mod = asRecord(modRaw);
    if (!mod) continue;
    modifierNet += moneyToCents(mod.postDiscountsAmount as Dollarish);
    modifierTax += moneyToCents(mod.taxesAmount as Dollarish);
  }
  const netSalesCents = item.__voided || giftCard ? 0 : post + modifierNet;
  return {
    externalItemId: str(item.menuItemId),
    externalLineId: null,
    name: str(item.name) ?? "Item",
    quantity: parseQuantity(item.quantity ?? "1"),
    voided: item.__voided,
    giftCardIssueReload: giftCard,
    reportingCategoryId: null,
    reportingCategoryName: null,
    parentReportingCategoryId: null,
    parentReportingCategoryName: null,
    itemCreatedAt: str(item.createdAt),
    preDiscountsCents: pre,
    discountsCents: discounts,
    postDiscountsCents: post,
    taxCents: tax + modifierTax,
    totalCents: total,
    netSalesCents,
  };
}

export function normalizeRestaurantExportOrder(
  order: Record<string, unknown>,
  options?: { timezone?: string },
): NormalizedOrder {
  const externalOrderId = str(order.id);
  if (!externalOrderId) throw new Error("Export order missing id");

  const items = collectItemsFromOrder(order).map(itemToNormalized);
  const payments: NormalizedPayment[] = [];
  const adjustments: NormalizedAdjustment[] = [];
  let tipCents = 0;
  let surchargeCents = 0;
  let taxCents = sumCents(items.map((i) => i.taxCents));
  let liabilityCents = 0;

  const scheduled = Boolean(order.scheduled);
  const releasedAt = str(order.releasedAt);
  const treatAsLiability = scheduled && !releasedAt;

  for (const checkRaw of asArray(order.checks)) {
    const check = asRecord(checkRaw);
    if (!check) continue;
    tipCents += moneyToCents(check.gratuityAmount as Dollarish);
    for (const taxRaw of asArray(check.autoGratuityTaxes)) {
      const tax = asRecord(taxRaw);
      if (!tax) continue;
      const amount = moneyToCents(tax.amount as Dollarish);
      taxCents += amount;
      adjustments.push({
        kind: "tax",
        externalId: str(tax.taxId),
        name: str(tax.taxName),
        amountCents: amount,
      });
    }
    for (const surchargeRaw of asArray(check.surcharges)) {
      const surcharge = asRecord(surchargeRaw);
      if (!surcharge) continue;
      const amount = moneyToCents(surcharge.amount as Dollarish);
      surchargeCents += amount;
      adjustments.push({
        kind: "surcharge",
        externalId: str(surcharge.surchargeId),
        name: str(surcharge.surchargeName),
        amountCents: amount,
      });
      taxCents += moneyToCents(surcharge.taxesAmount as Dollarish);
    }
    for (const paymentRaw of asArray(check.payments)) {
      const payment = asRecord(paymentRaw);
      if (!payment) continue;
      const amount = moneyToCents(payment.amount as Dollarish);
      const tip = moneyToCents(payment.tipAmount as Dollarish);
      const tipDeduction = moneyToCents(payment.tipDeductionAmount as Dollarish);
      let paySurcharge = 0;
      if (typeof payment.surchargesAmount === "number" || typeof payment.surchargesAmount === "string") {
        // Docs mark surchargesAmount as int64 in one place and DOLLARAMOUNT elsewhere; accept both.
        paySurcharge =
          typeof payment.surchargesAmount === "number" && Number.isInteger(payment.surchargesAmount)
            ? payment.surchargesAmount
            : moneyToCents(payment.surchargesAmount);
      }
      for (const s of asArray(payment.surcharges)) {
        const surcharge = asRecord(s);
        if (!surcharge) continue;
        const amt = moneyToCents(surcharge.amount as Dollarish);
        paySurcharge += amt;
        adjustments.push({
          kind: "surcharge",
          externalId: str(surcharge.surchargeId),
          name: str(surcharge.surchargeName),
          amountCents: amt,
        });
      }
      tipCents += tip;
      surchargeCents += paySurcharge;
      payments.push({
        externalPaymentOptionId: str(payment.paymentOptionId),
        paymentName: str(payment.paymentName),
        amountCents: amount,
        tipCents: tip,
        tipDeductionCents: tipDeduction,
        surchargeCents: paySurcharge,
        paidAt: str(payment.createdAt),
        cardType: str(payment.cardType),
        cardLast4: extractCardLast4(payment.cardNumber),
      });
    }
  }

  for (const item of items) {
    if (item.giftCardIssueReload && !item.voided) {
      liabilityCents += item.postDiscountsCents;
    }
    if (item.discountsCents) {
      adjustments.push({
        kind: "discount",
        externalId: null,
        name: item.name,
        amountCents: item.discountsCents,
      });
    }
  }

  const grossSalesCents = sumCents(items.filter((i) => !i.voided).map((i) => i.preDiscountsCents));
  const discountsCents = sumCents(items.filter((i) => !i.voided).map((i) => i.discountsCents));
  let netSalesCents = sumCents(items.filter((i) => !i.voided).map((i) => i.netSalesCents));
  if (treatAsLiability) {
    liabilityCents += netSalesCents;
    netSalesCents = 0;
  }

  const totalCents = moneyToCents(order.totalAmount as Dollarish);
  const hasItemTimestamps = items.some((i) => Boolean(i.itemCreatedAt));

  return {
    apiProduct: "restaurant_export",
    locationId: str(order.locationId) ?? "",
    externalOrderId,
    orderNumber: str(order.orderNumber),
    orderName: str(order.name),
    orderTypeName: str(order.orderTypeName),
    orderStatus: str(order.closedAt) ? "CLOSED" : "OPEN",
    deleted: Boolean(order.deleted),
    scheduled,
    giftCardOrLiability: liabilityCents > 0,
    businessDate: null,
    fiscalDate: null,
    timezone: options?.timezone ?? DEFAULT_VENUE_TIMEZONE,
    openedAt: str(order.createdAt),
    closedAt: str(order.closedAt),
    releasedAt,
    sourceUpdatedAt: str(order.updatedAt),
    sourceVersion: str(order.updatedAt),
    attributionBasis: hasItemTimestamps ? "item_timestamps" : "order_timestamps",
    guestCount: null,
    tableNumber: str(order.tableNumber),
    grossSalesCents,
    discountsCents,
    refundsCents: 0,
    netSalesCents: order.deleted ? 0 : netSalesCents,
    taxCents: order.deleted ? 0 : taxCents,
    tipCents: order.deleted ? 0 : tipCents,
    surchargeCents: order.deleted ? 0 : surchargeCents,
    totalCents: order.deleted ? 0 : totalCents,
    liabilityCents,
    isCompleteSnapshot: true,
    rawAllowlist: sanitizeOrderAllowlist(order),
    items,
    adjustments,
    payments,
  };
}
