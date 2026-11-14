import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { isMissingCustomerRelation } from "@/lib/customer/catalog";

type Client = SupabaseClient<Database>;

function missing(message: string | undefined) {
  return isMissingCustomerRelation(message);
}

export async function listMenuItems(client: Client, venueId: string) {
  const { data, error } = await client
    .from("menu_items")
    .select("*")
    .eq("venue_id", venueId)
    .is("archived_at", null)
    .order("category")
    .order("sort_order");
  return { items: data ?? [], error: error?.message ?? null, missing: missing(error?.message) };
}

export async function listMerchProducts(client: Client, venueId: string) {
  const { data, error } = await client
    .from("merch_products")
    .select("*")
    .eq("venue_id", venueId)
    .is("archived_at", null)
    .order("sort_order");
  return { products: data ?? [], error: error?.message ?? null, missing: missing(error?.message) };
}

export async function listCustomerRecordings(client: Client, venueId: string) {
  const { data, error } = await client
    .from("customer_recordings")
    .select("*")
    .eq("venue_id", venueId)
    .is("archived_at", null)
    .order("recorded_at", { ascending: false });
  return { recordings: data ?? [], error: error?.message ?? null, missing: missing(error?.message) };
}

export async function listMerchOrders(client: Client, venueId: string) {
  const { data, error } = await client
    .from("merch_orders")
    .select("id, status, customer_email, customer_name, total_cents, currency, checkout_mode, created_at")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return { orders: [], error: error.message, missing: missing(error.message) };
  const ids = (data ?? []).map((order) => order.id);
  const items = ids.length
    ? await client.from("merch_order_items").select("order_id, name_snapshot, quantity, unit_price_cents").in("order_id", ids)
    : { data: [], error: null };
  if (items.error) return { orders: [], error: items.error.message, missing: missing(items.error.message) };
  const grouped = new Map<string, { name: string; quantity: number; unitPriceCents: number }[]>();
  for (const item of items.data ?? []) {
    const list = grouped.get(item.order_id) ?? [];
    list.push({ name: item.name_snapshot, quantity: item.quantity, unitPriceCents: item.unit_price_cents });
    grouped.set(item.order_id, list);
  }
  return {
    orders: (data ?? []).map((order) => ({ ...order, items: grouped.get(order.id) ?? [] })),
    error: null,
    missing: false,
  };
}
