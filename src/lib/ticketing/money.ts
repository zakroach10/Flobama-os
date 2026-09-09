export function formatCents(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format((cents || 0) / 100);
}

export function dollarsToCents(raw: string | number) {
  const value = typeof raw === "number" ? raw : Number.parseFloat(raw.replace(/[$,]/g, ""));
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export function applyFees(subtotalCents: number, feeBps: number, taxBps: number) {
  const fees = Math.floor((subtotalCents * Math.max(0, feeBps)) / 10000);
  const tax = Math.floor((subtotalCents * Math.max(0, taxBps)) / 10000);
  return { fees, tax, total: subtotalCents + fees + tax };
}

export function remainingCapacity(input: {
  quantity: number;
  blockedQuantity: number;
  sold: number;
  held: number;
}) {
  return Math.max(0, input.quantity - input.blockedQuantity - input.sold - input.held);
}
