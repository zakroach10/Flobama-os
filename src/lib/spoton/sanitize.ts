/**
 * Retain only allowlisted fields after signature verification.
 * Never persist card PANs, CVV, full customer PII, or secrets.
 */

const TOP_LEVEL_KEYS = new Set([
  "id",
  "timestamp",
  "category",
  "location_id",
  "organization_id",
  "details",
]);

const DETAIL_KEYS = new Set([
  "menu",
  "item",
  "modifier",
  "order",
  "locationConnection",
  "fohReservationTicket",
  "onboarding",
]);

const ITEM_KEYS = new Set([
  "id",
  "type",
  "name",
  "available",
  "menu_id",
  "category_id",
  "category_name",
  "updated_at",
]);

const MENU_KEYS = new Set(["id", "type", "name", "updated_at"]);

const ORDER_KEYS = new Set([
  "id",
  "type",
  "status",
  "order_number",
  "updated_at",
  "canceled_at",
  "fulfillment_status",
]);

const FORBIDDEN_KEY_PATTERN =
  /(password|secret|token|authorization|card_number|pan|cvv|cvc|track|magnetic|ssn|signature_key)/i;

function scrubObject(value: unknown, depth = 0): unknown {
  if (depth > 8) return undefined;
  if (value == null) return value;
  if (Array.isArray(value)) {
    return value.map((entry) => scrubObject(entry, depth + 1)).filter((entry) => entry !== undefined);
  }
  if (typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEY_PATTERN.test(key)) continue;
    if (/email|phone|address|first_name|last_name|cardholder/i.test(key)) continue;
    const scrubbed = scrubObject(child, depth + 1);
    if (scrubbed !== undefined) out[key] = scrubbed;
  }
  return out;
}

function pick(obj: Record<string, unknown> | null | undefined, keys: Set<string>) {
  if (!obj) return {};
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in obj) out[key] = scrubObject(obj[key]);
  }
  return out;
}

export function sanitizeWebhookPayload(parsed: unknown): Record<string, unknown> {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }
  const root = parsed as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of TOP_LEVEL_KEYS) {
    if (!(key in root)) continue;
    if (key !== "details") {
      out[key] = scrubObject(root[key]);
      continue;
    }
    const details = root.details;
    if (!details || typeof details !== "object" || Array.isArray(details)) {
      out.details = {};
      continue;
    }
    const detailsObj = details as Record<string, unknown>;
    const sanitizedDetails: Record<string, unknown> = {};
    for (const detailKey of DETAIL_KEYS) {
      if (!(detailKey in detailsObj)) continue;
      const detail = detailsObj[detailKey];
      if (!detail || typeof detail !== "object" || Array.isArray(detail)) {
        sanitizedDetails[detailKey] = scrubObject(detail);
        continue;
      }
      const detailRecord = detail as Record<string, unknown>;
      if (detailKey === "item") sanitizedDetails.item = pick(detailRecord, ITEM_KEYS);
      else if (detailKey === "menu") sanitizedDetails.menu = pick(detailRecord, MENU_KEYS);
      else if (detailKey === "order") sanitizedDetails.order = pick(detailRecord, ORDER_KEYS);
      else sanitizedDetails[detailKey] = scrubObject(detailRecord);
    }
    out.details = sanitizedDetails;
  }
  return out;
}

/** Allowlisted fields retained from a Restaurant Export / Central order for diagnostics. */
export function sanitizeOrderAllowlist(order: Record<string, unknown>): Record<string, unknown> {
  const keys = [
    "id",
    "name",
    "deleted",
    "locationId",
    "location_id",
    "orderNumber",
    "order_number",
    "orderTypeName",
    "order_type",
    "createdAt",
    "created_at",
    "closedAt",
    "closed_at",
    "updatedAt",
    "last_updated_at",
    "releasedAt",
    "released_at",
    "scheduled",
    "fiscal_date",
    "businessDate",
    "order_status",
    "tableNumber",
    "table_number",
    "guest_count",
  ];
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in order) out[key] = order[key];
  }
  return out;
}

export function extractCardLast4(cardNumber: unknown): string | null {
  if (typeof cardNumber !== "string") return null;
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.length < 4) return null;
  return digits.slice(-4);
}
