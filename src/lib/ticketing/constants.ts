export const TICKETING_HOLD_MINUTES = 10;
export const TICKETING_SQL = "supabase/migrations/20260909000008_ticketing.sql";
export const TICKETING_SESSION_COOKIE = "flobama_ticket_session";
export const MASTER_LAYOUT_ID = "22222222-2222-4222-8222-222222222222";

export const LAYOUT_OBJECT_TYPES = [
  "table",
  "booth",
  "bar",
  "stage",
  "dance_floor",
  "standing",
  "vip_area",
  "entrance",
  "label",
  "decor",
] as const;
export type LayoutObjectType = (typeof LAYOUT_OBJECT_TYPES)[number];

export const LAYOUT_OBJECT_LABELS: Record<LayoutObjectType, string> = {
  table: "Table",
  booth: "Booth",
  bar: "Bar",
  stage: "Stage",
  dance_floor: "Dance floor",
  standing: "Standing",
  vip_area: "VIP area",
  entrance: "Entrance",
  label: "Label",
  decor: "Decor",
};

export const LAYOUT_SHAPES = ["rect", "round", "ellipse"] as const;
export type LayoutShape = (typeof LAYOUT_SHAPES)[number];

export const TABLE_STATUSES = ["available", "held", "sold", "blocked", "comp", "unavailable"] as const;
export type TableInventoryStatus = (typeof TABLE_STATUSES)[number];

export const TABLE_STATUS_LABELS: Record<TableInventoryStatus, string> = {
  available: "Available",
  held: "Held",
  sold: "Sold",
  blocked: "Blocked",
  comp: "Comp",
  unavailable: "Unavailable",
};

export const TICKET_TYPE_KINDS = ["ga", "vip", "other"] as const;
export type TicketTypeKind = (typeof TICKET_TYPE_KINDS)[number];

export const TICKET_TYPE_KIND_LABELS: Record<TicketTypeKind, string> = {
  ga: "General admission",
  vip: "VIP",
  other: "Other",
};

export const ORDER_STATUSES = ["pending", "paid", "cancelled", "refunded", "partially_refunded"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ["pending", "succeeded", "failed", "refunded", "partially_refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const TICKET_STATUSES = ["valid", "checked_in", "void", "refunded"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const ORDER_ITEM_KINDS = ["ticket", "table", "comp"] as const;
export type OrderItemKind = (typeof ORDER_ITEM_KINDS)[number];

export const PAYMENT_PROVIDERS = ["mock", "stripe", "manual"] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];
