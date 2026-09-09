import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { MASTER_LAYOUT_ID, type TableInventoryStatus, type TicketTypeKind } from "@/lib/ticketing/constants";
import { isMissingTicketingSchema } from "@/lib/ticketing/errors";

type Client = SupabaseClient<Database>;
type AnyClient = SupabaseClient;

function db(client: Client): AnyClient {
  return client as unknown as AnyClient;
}

export type EventTicketingRow = {
  event_id: string;
  venue_id: string;
  enabled: boolean;
  doors_at: string | null;
  capacity: number | null;
  sales_start: string | null;
  sales_end: string | null;
  max_tickets_per_order: number;
  hold_minutes: number;
  tables_enabled: boolean;
  refunds_enabled: boolean;
  refund_policy: string | null;
  age_restriction: string | null;
  parking_notes: string | null;
  venue_notes: string | null;
  source_layout_id: string | null;
  fee_bps: number;
  tax_bps: number;
};

export type TicketTypeRow = {
  id: string;
  event_id: string;
  venue_id: string;
  name: string;
  description: string | null;
  kind: TicketTypeKind;
  price_cents: number;
  quantity: number;
  blocked_quantity: number;
  max_per_order: number;
  sales_start: string | null;
  sales_end: string | null;
  active: boolean;
  visibility: "public" | "hidden";
  sort_order: number;
};

export type LayoutObjectRow = {
  id: string;
  venue_id: string;
  object_type: string;
  name: string;
  capacity: number;
  x_position: number;
  y_position: number;
  width: number;
  height: number;
  rotation: number;
  shape: "rect" | "round" | "ellipse";
  table_number: string | null;
  section: string | null;
  default_price_cents?: number | null;
  price_cents?: number | null;
  sellable: boolean;
  vip?: boolean;
  status?: TableInventoryStatus;
  hold_until?: string | null;
  sold_order_id?: string | null;
  sort_order: number;
};

export type VenueLayoutRow = {
  id: string;
  venue_id: string;
  name: string;
  is_default: boolean;
  canvas_width: number;
  canvas_height: number;
};

export type TicketingOrderRow = {
  id: string;
  venue_id: string;
  event_id: string;
  order_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  subtotal_cents: number;
  fees_cents: number;
  tax_cents: number;
  total_cents: number;
  payment_status: string;
  order_status: string;
  provider: string;
  provider_ref: string | null;
  created_at: string;
};

export async function getEventTicketing(client: Client, eventId: string) {
  const { data, error } = await db(client).from("event_ticketing").select("*").eq("event_id", eventId).maybeSingle();
  if (error) return { settings: null as EventTicketingRow | null, error: error.message, missing: isMissingTicketingSchema(error.message) };
  return { settings: (data as EventTicketingRow | null) ?? null, error: null, missing: false };
}

export async function listTicketTypes(client: Client, eventId: string) {
  const { data, error } = await db(client)
    .from("ticket_types")
    .select("*")
    .eq("event_id", eventId)
    .order("sort_order");
  if (error) return { types: [] as TicketTypeRow[], error: error.message, missing: isMissingTicketingSchema(error.message) };
  return { types: (data ?? []) as TicketTypeRow[], error: null, missing: false };
}

export async function listVenueLayouts(client: Client, venueId: string) {
  const { data, error } = await db(client)
    .from("venue_layouts")
    .select("*")
    .eq("venue_id", venueId)
    .order("name");
  if (error) return { layouts: [] as VenueLayoutRow[], error: error.message, missing: isMissingTicketingSchema(error.message) };
  return { layouts: (data ?? []) as VenueLayoutRow[], error: null, missing: false };
}

export async function getDefaultVenueLayout(client: Client, venueId: string) {
  const { data, error } = await db(client)
    .from("venue_layouts")
    .select("*")
    .eq("venue_id", venueId)
    .eq("is_default", true)
    .maybeSingle();
  if (error) return { layout: null as VenueLayoutRow | null, error: error.message, missing: isMissingTicketingSchema(error.message) };
  return { layout: (data as VenueLayoutRow | null) ?? null, error: null, missing: false };
}

export async function listLayoutObjects(client: Client, layoutId: string) {
  const { data, error } = await db(client)
    .from("venue_layout_objects")
    .select("*")
    .eq("layout_id", layoutId)
    .order("sort_order");
  if (error) return { objects: [] as LayoutObjectRow[], error: error.message };
  return { objects: (data ?? []) as LayoutObjectRow[], error: null };
}

export async function getEventLayout(client: Client, eventId: string) {
  const { data, error } = await db(client).from("event_layouts").select("*").eq("event_id", eventId).maybeSingle();
  if (error) return { layout: null, error: error.message, missing: isMissingTicketingSchema(error.message) };
  return { layout: data as { id: string; event_id: string; canvas_width: number; canvas_height: number } | null, error: null, missing: false };
}

export async function listEventLayoutObjects(client: Client, eventId: string) {
  const { data, error } = await db(client)
    .from("event_layout_objects")
    .select("*")
    .eq("event_id", eventId)
    .order("sort_order");
  if (error) return { objects: [] as LayoutObjectRow[], error: error.message };
  return { objects: (data ?? []) as LayoutObjectRow[], error: null };
}

export async function listTicketingOrders(client: Client, venueId: string, eventId?: string) {
  let query = db(client).from("ticketing_orders").select("*").eq("venue_id", venueId).order("created_at", { ascending: false }).limit(100);
  if (eventId) query = query.eq("event_id", eventId);
  const { data, error } = await query;
  if (error) return { orders: [] as TicketingOrderRow[], error: error.message, missing: isMissingTicketingSchema(error.message) };
  return { orders: (data ?? []) as TicketingOrderRow[], error: null, missing: false };
}

export async function getTicketingOrder(client: Client, orderId: string) {
  const { data, error } = await db(client).from("ticketing_orders").select("*").eq("id", orderId).maybeSingle();
  if (error) return { order: null as TicketingOrderRow | null, error: error.message };
  return { order: (data as TicketingOrderRow | null) ?? null, error: null };
}

export async function listOrderItems(client: Client, orderId: string) {
  const { data, error } = await db(client).from("ticketing_order_items").select("*").eq("order_id", orderId);
  if (error) return { items: [] as Record<string, unknown>[], error: error.message };
  return { items: data ?? [], error: null };
}

export async function listOrderTickets(client: Client, orderId: string) {
  const { data, error } = await db(client).from("tickets").select("*").eq("order_id", orderId);
  if (error) return { tickets: [] as Record<string, unknown>[], error: error.message };
  return { tickets: data ?? [], error: null };
}

export async function findTicketByQr(client: Client, token: string) {
  const { data, error } = await db(client).from("tickets").select("*").eq("qr_token", token).maybeSingle();
  if (error) return { ticket: null as Record<string, unknown> | null, error: error.message };
  return { ticket: data as Record<string, unknown> | null, error: null };
}

export async function searchEventTickets(
  client: Client,
  eventId: string,
  query: string,
) {
  const q = query.trim();
  if (!q) {
    const { data, error } = await db(client)
      .from("tickets")
      .select("*, ticketing_orders(order_number, first_name, last_name, email, phone), event_layout_objects(name, table_number)")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) return { tickets: [], error: error.message };
    return { tickets: data ?? [], error: null };
  }
  const { data: byToken } = await db(client)
    .from("tickets")
    .select("*, ticketing_orders(order_number, first_name, last_name, email, phone), event_layout_objects(name, table_number)")
    .eq("event_id", eventId)
    .eq("qr_token", q)
    .maybeSingle();
  if (byToken) return { tickets: [byToken], error: null };
  const { data: orders } = await db(client)
    .from("ticketing_orders")
    .select("id")
    .eq("event_id", eventId)
    .or(`order_number.ilike.%${q}%,email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%`);
  const ids = (orders ?? []).map((row: { id: string }) => row.id);
  const { data: tableMatches } = await db(client)
    .from("event_layout_objects")
    .select("id")
    .eq("event_id", eventId)
    .or(`table_number.ilike.%${q}%,name.ilike.%${q}%`);
  const tableIds = (tableMatches ?? []).map((row: { id: string }) => row.id);
  const filters = [`purchaser_name.ilike.%${q}%`];
  if (ids.length) filters.push(`order_id.in.(${ids.join(",")})`);
  if (tableIds.length) filters.push(`layout_object_id.in.(${tableIds.join(",")})`);
  const { data, error } = await db(client)
    .from("tickets")
    .select("*, ticketing_orders(order_number, first_name, last_name, email, phone), event_layout_objects(name, table_number)")
    .eq("event_id", eventId)
    .or(filters.join(","))
    .limit(40);
  if (error) return { tickets: [], error: error.message };
  return { tickets: data ?? [], error: null };
}

export async function listTicketedEvents(client: Client, venueId: string) {
  const { data, error } = await db(client)
    .from("event_ticketing")
    .select("*, events(id, title, starts_at, ends_at, status, archived_at)")
    .eq("venue_id", venueId)
    .eq("enabled", true);
  if (error) return { rows: [] as Array<Record<string, unknown>>, error: error.message, missing: isMissingTicketingSchema(error.message) };
  return { rows: (data ?? []) as Array<Record<string, unknown>>, error: null, missing: false };
}

export async function eventSalesSummary(client: Client, eventId: string) {
  const { data: orders, error } = await db(client)
    .from("ticketing_orders")
    .select("id, total_cents, order_status, payment_status")
    .eq("event_id", eventId);
  if (error) return { summary: null, error: error.message, missing: isMissingTicketingSchema(error.message) };
  const orderRows = (orders ?? []) as Array<{ id: string; total_cents: number; order_status: string; payment_status: string }>;
  const paid = orderRows.filter((row) => row.order_status === "paid" || row.order_status === "partially_refunded");
  const refunds = orderRows.filter((row) => row.order_status === "refunded" || row.order_status === "partially_refunded");
  const { data: tickets } = await db(client).from("tickets").select("id, admissions_total, admissions_checked_in, layout_object_id, ticket_type_id").eq("event_id", eventId);
  const list = (tickets ?? []) as Array<{
    admissions_total: number;
    admissions_checked_in: number;
    layout_object_id: string | null;
    ticket_type_id: string | null;
  }>;
  const ticketsSold = list.filter((row) => row.ticket_type_id).reduce((sum, row) => sum + row.admissions_total, 0);
  const tablesSold = list.filter((row) => row.layout_object_id).length;
  const checkedIn = list.reduce((sum, row) => sum + row.admissions_checked_in, 0);
  const admissions = list.reduce((sum, row) => sum + row.admissions_total, 0);
  const gross = paid.reduce((sum, row) => sum + row.total_cents, 0);
  const refundedCents = refunds.reduce((sum, row) => sum + row.total_cents, 0);
  const { data: types } = await db(client)
    .from("ticket_types")
    .select("quantity, blocked_quantity, id")
    .eq("event_id", eventId);
  const { data: tableRows } = await db(client)
    .from("event_layout_objects")
    .select("status, capacity, sellable")
    .eq("event_id", eventId)
    .eq("sellable", true);
  const typeList = (types ?? []) as Array<{ quantity: number; blocked_quantity: number; id: string }>;
  const soldByType = list.filter((row) => row.ticket_type_id);
  const remainingTickets = typeList.reduce((sum, type) => {
    const sold = soldByType.filter((row) => row.ticket_type_id === type.id).length;
    return sum + Math.max(0, type.quantity - type.blocked_quantity - sold);
  }, 0);
  const remainingTableSeats = ((tableRows ?? []) as Array<{ status: string; capacity: number }>).reduce((sum, row) => {
    if (row.status === "available") return sum + row.capacity;
    return sum;
  }, 0);
  return {
    summary: {
      ticketsSold,
      tablesSold,
      orders: paid.length,
      refunds: refunds.length,
      grossCents: gross,
      netCents: Math.max(0, gross - refundedCents),
      checkedIn,
      admissions,
      remainingCapacity: remainingTickets + remainingTableSeats,
    },
    error: null,
    missing: false,
  };
}

export async function listCustomers(client: Client, venueId: string) {
  const { data, error } = await db(client)
    .from("ticketing_orders")
    .select("first_name, last_name, email, phone, total_cents, created_at, order_number, event_id")
    .eq("venue_id", venueId)
    .eq("order_status", "paid")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return { customers: [] as TicketingOrderRow[], error: error.message, missing: isMissingTicketingSchema(error.message) };
  return { customers: (data ?? []) as TicketingOrderRow[], error: null, missing: false };
}

export { MASTER_LAYOUT_ID, FLO_BAMA_VENUE_ID };
