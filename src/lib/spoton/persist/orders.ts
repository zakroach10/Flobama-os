import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedOrder } from "@/lib/spoton/types";

/**
 * Upsert an authoritative order snapshot.
 * Stale updates (older source_updated_at / source_version) are skipped.
 * Replacing children is idempotent — re-import does not increase revenue.
 */
export async function upsertNormalizedOrder(
  admin: SupabaseClient,
  venueId: string,
  order: NormalizedOrder,
): Promise<"inserted" | "updated" | "skipped_stale" | "skipped_incomplete"> {
  if (!order.isCompleteSnapshot) {
    // Partial webhook payloads must not overwrite complete records.
    const existing = await admin
      .from("spoton_orders")
      .select("id, is_complete_snapshot, source_updated_at")
      .eq("venue_id", venueId)
      .eq("api_product", order.apiProduct)
      .eq("external_order_id", order.externalOrderId)
      .maybeSingle();
    if (existing.data?.is_complete_snapshot) return "skipped_incomplete";
  }

  const existingRes = await admin
    .from("spoton_orders")
    .select("id, source_updated_at, source_version, is_complete_snapshot")
    .eq("venue_id", venueId)
    .eq("api_product", order.apiProduct)
    .eq("external_order_id", order.externalOrderId)
    .maybeSingle();

  if (existingRes.error) throw new Error(existingRes.error.message);
  const existing = existingRes.data;

  if (existing?.source_updated_at && order.sourceUpdatedAt) {
    const existingTs = Date.parse(existing.source_updated_at);
    const incomingTs = Date.parse(order.sourceUpdatedAt);
    if (Number.isFinite(existingTs) && Number.isFinite(incomingTs) && incomingTs < existingTs) {
      return "skipped_stale";
    }
  }
  if (
    existing?.source_version &&
    order.sourceVersion &&
    existing.source_version === order.sourceVersion &&
    existing.is_complete_snapshot &&
    order.isCompleteSnapshot
  ) {
    // Identical version — still refresh children for safety on first implementation,
    // but treat as update rather than double-count.
  }

  const row = {
    venue_id: venueId,
    api_product: order.apiProduct,
    location_id: order.locationId,
    external_order_id: order.externalOrderId,
    order_number: order.orderNumber,
    order_name: order.orderName,
    order_type_name: order.orderTypeName,
    order_status: order.orderStatus,
    deleted: order.deleted,
    scheduled: order.scheduled,
    gift_card_or_liability: order.giftCardOrLiability,
    business_date: order.businessDate,
    fiscal_date: order.fiscalDate,
    timezone: order.timezone,
    opened_at: order.openedAt,
    closed_at: order.closedAt,
    released_at: order.releasedAt,
    source_updated_at: order.sourceUpdatedAt,
    source_version: order.sourceVersion,
    attribution_basis: order.attributionBasis,
    guest_count: order.guestCount,
    table_number: order.tableNumber,
    gross_sales_cents: order.grossSalesCents,
    discounts_cents: order.discountsCents,
    refunds_cents: order.refundsCents,
    net_sales_cents: order.netSalesCents,
    tax_cents: order.taxCents,
    tip_cents: order.tipCents,
    surcharge_cents: order.surchargeCents,
    total_cents: order.totalCents,
    liability_cents: order.liabilityCents,
    is_complete_snapshot: order.isCompleteSnapshot,
    raw_allowlist: order.rawAllowlist,
  };

  let orderId = existing?.id as string | undefined;
  if (existing?.id) {
    const update = await admin.from("spoton_orders").update(row).eq("id", existing.id).select("id").single();
    if (update.error) throw new Error(update.error.message);
    orderId = update.data.id;
  } else {
    const insert = await admin.from("spoton_orders").insert(row).select("id").single();
    if (insert.error) throw new Error(insert.error.message);
    orderId = insert.data.id;
  }

  if (!orderId) throw new Error("Order upsert missing id");

  // Replace children atomically-enough for this environment (delete then insert).
  const delItems = await admin.from("spoton_order_items").delete().eq("order_id", orderId);
  if (delItems.error) throw new Error(delItems.error.message);
  const delAdj = await admin.from("spoton_order_adjustments").delete().eq("order_id", orderId);
  if (delAdj.error) throw new Error(delAdj.error.message);
  const delPay = await admin.from("spoton_order_payments").delete().eq("order_id", orderId);
  if (delPay.error) throw new Error(delPay.error.message);

  if (order.items.length) {
    const itemRows = order.items.map((item) => ({
      venue_id: venueId,
      order_id: orderId,
      external_item_id: item.externalItemId,
      external_line_id: item.externalLineId,
      name: item.name,
      quantity: item.quantity,
      voided: item.voided,
      gift_card_issue_reload: item.giftCardIssueReload,
      reporting_category_id: item.reportingCategoryId,
      reporting_category_name: item.reportingCategoryName,
      parent_reporting_category_id: item.parentReportingCategoryId,
      parent_reporting_category_name: item.parentReportingCategoryName,
      item_created_at: item.itemCreatedAt,
      pre_discounts_cents: item.preDiscountsCents,
      discounts_cents: item.discountsCents,
      post_discounts_cents: item.postDiscountsCents,
      tax_cents: item.taxCents,
      total_cents: item.totalCents,
      net_sales_cents: item.netSalesCents,
    }));
    const inserted = await admin.from("spoton_order_items").insert(itemRows);
    if (inserted.error) throw new Error(inserted.error.message);
  }

  if (order.adjustments.length) {
    const adjRows = order.adjustments.map((adj) => ({
      venue_id: venueId,
      order_id: orderId,
      kind: adj.kind,
      external_id: adj.externalId,
      name: adj.name,
      amount_cents: adj.amountCents,
    }));
    const inserted = await admin.from("spoton_order_adjustments").insert(adjRows);
    if (inserted.error) throw new Error(inserted.error.message);
  }

  if (order.payments.length) {
    const payRows = order.payments.map((payment) => ({
      venue_id: venueId,
      order_id: orderId,
      external_payment_option_id: payment.externalPaymentOptionId,
      payment_name: payment.paymentName,
      amount_cents: payment.amountCents,
      tip_cents: payment.tipCents,
      tip_deduction_cents: payment.tipDeductionCents,
      surcharge_cents: payment.surchargeCents,
      paid_at: payment.paidAt,
      card_type: payment.cardType,
      card_last4: payment.cardLast4,
    }));
    const inserted = await admin.from("spoton_order_payments").insert(payRows);
    if (inserted.error) throw new Error(inserted.error.message);
  }

  return existing ? "updated" : "inserted";
}
