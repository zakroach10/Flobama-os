import type { CustomerMerch, PricedLine } from "@/lib/customer/types";

export const MERCH_MAX_QTY = 8;
export const MERCH_MAX_LINES = 12;

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function dollarsToCents(input: string): number | null {
  const trimmed = input.trim().replace(/^\$/, "");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const cents = Math.round(Number(trimmed) * 100);
  if (!Number.isInteger(cents) || cents < 50 || cents > 100_000) return null;
  return cents;
}

export function priceCart(
  merch: CustomerMerch[],
  lines: { productId: string; quantity: number }[],
): { ok: true; items: PricedLine[]; totalCents: number; currency: "usd" } | { ok: false; error: string } {
  if (!Array.isArray(lines) || lines.length === 0) {
    return { ok: false, error: "Add at least one item." };
  }
  if (lines.length > MERCH_MAX_LINES) {
    return { ok: false, error: "Too many items in one order." };
  }
  const items: PricedLine[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    if (!line || typeof line.productId !== "string" || seen.has(line.productId)) {
      return { ok: false, error: "Each item can only appear once." };
    }
    seen.add(line.productId);
    const product = merch.find((row) => row.id === line.productId);
    if (!product) return { ok: false, error: "That item is no longer available." };
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MERCH_MAX_QTY) {
      return { ok: false, error: `Quantity must be between 1 and ${MERCH_MAX_QTY}.` };
    }
    items.push({
      productId: product.id,
      name: product.name,
      quantity: line.quantity,
      unitPriceCents: product.priceCents,
    });
  }
  const totalCents = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
  if (totalCents <= 0) return { ok: false, error: "Order total is not valid." };
  return { ok: true, items, totalCents, currency: "usd" };
}
