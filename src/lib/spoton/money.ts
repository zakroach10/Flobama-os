/**
 * Exact money helpers for SpotOn amounts.
 * Prefer decimal strings (Restaurant Export DOLLARAMOUNT). JSON numbers from
 * Central API are converted via fixed 2-decimal strings — never float multiply.
 */

export function parseCentsFromDecimalString(raw: string): number {
  const cleaned = raw.trim().replace(/,/g, "").replace(/^\$/, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") {
    throw new Error(`Invalid money amount: ${raw}`);
  }
  const match = cleaned.match(/^(-)?(\d*)(?:\.(\d*))?$/);
  if (!match || (match[2] === "" && (match[3] == null || match[3] === ""))) {
    throw new Error(`Invalid money amount: ${raw}`);
  }
  const sign = match[1] ? -1 : 1;
  const whole = match[2] === "" ? "0" : match[2];
  const fracRaw = match[3] ?? "";
  let frac = fracRaw.padEnd(2, "0");
  if (frac.length > 2) {
    const third = Number(frac[2] ?? "0");
    frac = frac.slice(0, 2);
    let cents = Number.parseInt(whole, 10) * 100 + Number.parseInt(frac, 10);
    if (third >= 5) cents += 1;
    return sign * cents;
  }
  return sign * (Number.parseInt(whole, 10) * 100 + Number.parseInt(frac, 10));
}

/** Convert SpotOn dollar amount (string or JSON number) to integer cents. */
export function moneyToCents(value: unknown): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Invalid money number");
    return parseCentsFromDecimalString(value.toFixed(2));
  }
  if (typeof value === "string") return parseCentsFromDecimalString(value);
  throw new Error(`Unsupported money type: ${typeof value}`);
}

export function tryMoneyToCents(value: unknown): number | null {
  try {
    return moneyToCents(value);
  } catch {
    return null;
  }
}

/** Fractional item quantities as exact decimal strings → number for Numeric columns. */
export function parseQuantity(value: unknown): string {
  if (value == null || value === "") return "1";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Invalid quantity");
    return String(value);
  }
  const raw = String(value).trim();
  // Restaurant Export may emit fractional quantities like ".5".
  if (!/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(raw)) throw new Error(`Invalid quantity: ${raw}`);
  return raw;
}

export function formatCentsExact(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export function sumCents(values: readonly number[]): number {
  return values.reduce((acc, value) => acc + value, 0);
}
