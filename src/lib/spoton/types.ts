export const SPOTON_API_PRODUCTS = ["none", "restaurant_export", "central_api"] as const;
export type SpotOnApiProduct = (typeof SPOTON_API_PRODUCTS)[number];

export const SPOTON_CAPABILITY_STATUSES = [
  "not_configured",
  "configured_unverified",
  "verified",
  "permission_denied",
  "unavailable",
] as const;
export type SpotOnCapabilityStatus = (typeof SPOTON_CAPABILITY_STATUSES)[number];

export const SPOTON_REPORTING_BUCKETS = ["food", "alcohol", "other", "unmapped"] as const;
export type SpotOnReportingBucket = (typeof SPOTON_REPORTING_BUCKETS)[number];

/** Documented Central API webhook event categories. */
export const SPOTON_WEBHOOK_CATEGORIES = [
  "EVENT_CATEGORY_MENU",
  "EVENT_CATEGORY_ITEM",
  "EVENT_CATEGORY_MODIFIER",
  "EVENT_CATEGORY_ORDER",
  "EVENT_CATEGORY_LOCATION_CONNECTION",
  "EVENT_CATEGORY_LABOR_TIME_PUNCH",
  "EVENT_CATEGORY_FOH",
  "EVENT_CATEGORY_ONBOARDING",
] as const;
export type SpotOnWebhookCategory = (typeof SPOTON_WEBHOOK_CATEGORIES)[number];

/** Categories this integration applies business effects for. */
export const SPOTON_SUPPORTED_WEBHOOK_CATEGORIES = [
  "EVENT_CATEGORY_MENU",
  "EVENT_CATEGORY_ITEM",
  "EVENT_CATEGORY_ORDER",
] as const;

export const SPOTON_CENTRAL_API_BASE = "https://api.spoton.com";
export const SPOTON_RESTAURANT_EXPORT_API_BASE = "https://restaurantapi.spoton.com";

/** Restaurant Export: max window 26h; end must be ≥5 minutes in the past. */
export const SPOTON_EXPORT_MAX_WINDOW_MS = 26 * 60 * 60 * 1000;
export const SPOTON_EXPORT_END_LAG_MS = 5 * 60 * 1000;
/** Approx retention called out in Export Orders docs. */
export const SPOTON_EXPORT_RETENTION_DAYS = 90;

export const SPOTON_WEBHOOK_MAX_BODY_BYTES = 512 * 1024;
export const SPOTON_SIGNATURE_VERSION = "v1";

export type SpotOnSettingsRow = {
  venue_id: string;
  api_product: SpotOnApiProduct;
  location_id: string | null;
  business_day_cutoff_local: string;
  event_window_pre_minutes: number;
  event_window_post_minutes: number;
  webhook_status: SpotOnCapabilityStatus;
  reporting_status: SpotOnCapabilityStatus;
  menu_status: SpotOnCapabilityStatus;
  last_webhook_at: string | null;
  last_webhook_event_id: string | null;
  last_processed_event_id: string | null;
  last_processed_event_at: string | null;
  last_successful_sync_at: string | null;
  coverage_through: string | null;
  last_connection_test_at: string | null;
  last_connection_test_ok: boolean | null;
  last_connection_test_message: string | null;
  sync_enabled: boolean;
  publish_mapped_menu: boolean;
  notes: string | null;
};

export type NormalizedOrderItem = {
  externalItemId: string | null;
  externalLineId: string | null;
  name: string;
  quantity: string;
  voided: boolean;
  giftCardIssueReload: boolean;
  reportingCategoryId: string | null;
  reportingCategoryName: string | null;
  parentReportingCategoryId: string | null;
  parentReportingCategoryName: string | null;
  itemCreatedAt: string | null;
  preDiscountsCents: number;
  discountsCents: number;
  postDiscountsCents: number;
  taxCents: number;
  totalCents: number;
  netSalesCents: number;
};

export type NormalizedAdjustment = {
  kind: "discount" | "tax" | "surcharge" | "fee" | "liability" | "refund";
  externalId: string | null;
  name: string | null;
  amountCents: number;
};

export type NormalizedPayment = {
  externalPaymentOptionId: string | null;
  paymentName: string | null;
  amountCents: number;
  tipCents: number;
  tipDeductionCents: number;
  surchargeCents: number;
  paidAt: string | null;
  cardType: string | null;
  cardLast4: string | null;
};

export type NormalizedOrder = {
  apiProduct: "restaurant_export" | "central_api" | "webhook";
  locationId: string;
  externalOrderId: string;
  orderNumber: string | null;
  orderName: string | null;
  orderTypeName: string | null;
  orderStatus: string | null;
  deleted: boolean;
  scheduled: boolean;
  giftCardOrLiability: boolean;
  businessDate: string | null;
  fiscalDate: string | null;
  timezone: string;
  openedAt: string | null;
  closedAt: string | null;
  releasedAt: string | null;
  sourceUpdatedAt: string | null;
  sourceVersion: string | null;
  attributionBasis: "item_timestamps" | "order_timestamps" | "unknown";
  guestCount: number | null;
  tableNumber: string | null;
  grossSalesCents: number;
  discountsCents: number;
  refundsCents: number;
  netSalesCents: number;
  taxCents: number;
  tipCents: number;
  surchargeCents: number;
  totalCents: number;
  liabilityCents: number;
  isCompleteSnapshot: boolean;
  rawAllowlist: Record<string, unknown>;
  items: NormalizedOrderItem[];
  adjustments: NormalizedAdjustment[];
  payments: NormalizedPayment[];
};

export type SpotOnConnectionTestResult = {
  ok: boolean;
  status: SpotOnCapabilityStatus;
  message: string;
  checkedAt: string;
};
