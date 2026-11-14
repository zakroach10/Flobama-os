import { isSupabaseConfigured } from "@/lib/env";
import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { createAnonSupabaseClient } from "@/lib/supabase/anon";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { buildFixtureCatalog, emptyCatalog } from "@/lib/customer/fixtures";
import { memoryOrderStore, type OrderStore } from "@/lib/customer/checkout";
import { mapArtist, mapMenuItem, mapMerch, mapRecording, mapShow, mapSpecial } from "@/lib/customer/public-map";
import type { CustomerCatalog, PricedLine, StoredOrder } from "@/lib/customer/types";

export function customerFixturesEnabled() {
  if (process.env.CUSTOMER_APP_FIXTURES === "1") return true;
  return !isSupabaseConfigured();
}

export function isMissingCustomerRelation(message: string | null | undefined) {
  if (!message) return false;
  return (
    /menu_items|merch_products|merch_orders|merch_order_items|customer_recordings|customer_event_listings|customer_artist_listings|customer_menu_item_listings|customer_merch_listings|customer_recording_listings/i.test(
      message,
    ) && /does not exist|schema cache|could not find/i.test(message)
  );
}

export const CUSTOMER_MIGRATION = "supabase/migrations/20261114000070_customer_app.sql";

export async function loadCustomerCatalog(now: Date = new Date()): Promise<{
  catalog: CustomerCatalog;
  sample: boolean;
  error: string | null;
  missing: boolean;
}> {
  if (customerFixturesEnabled()) {
    return { catalog: buildFixtureCatalog(now), sample: true, error: null, missing: false };
  }
  const client = createAnonSupabaseClient();
  if (!client) {
    return { catalog: emptyCatalog(), sample: false, error: "Public listings are not configured.", missing: false };
  }

  const venueId = FLO_BAMA_VENUE_ID;
  const [shows, artists, specials, menu, merch, recordings, showArtists] = await Promise.all([
    client.from("customer_event_listings").select("*").eq("venue_id", venueId).order("starts_at", { ascending: true }).limit(80),
    client.from("customer_artist_listings").select("*").eq("venue_id", venueId).order("name", { ascending: true }).limit(200),
    client.from("customer_menu_special_listings").select("*").eq("venue_id", venueId),
    client.from("customer_menu_item_listings").select("*").eq("venue_id", venueId).order("sort_order", { ascending: true }),
    client.from("customer_merch_listings").select("*").eq("venue_id", venueId).order("sort_order", { ascending: true }),
    client.from("customer_recording_listings").select("*").eq("venue_id", venueId).order("recorded_at", { ascending: false }),
    client.from("customer_event_artists").select("*").eq("venue_id", venueId).order("display_order", { ascending: true }),
  ]);

  const firstError = [shows, artists, specials, menu, merch, recordings, showArtists].find((result) => result.error)?.error;
  if (firstError) {
    return {
      catalog: emptyCatalog(),
      sample: false,
      error: firstError.message,
      missing: isMissingCustomerRelation(firstError.message),
    };
  }

  const artistsByEvent = new Map<string, { id: string; name: string; genre: string | null; display_order: number }[]>();
  for (const row of showArtists.data ?? []) {
    const list = artistsByEvent.get(row.event_id) ?? [];
    list.push({ id: row.artist_id, name: row.name, genre: row.genre, display_order: row.display_order });
    artistsByEvent.set(row.event_id, list);
  }

  return {
    sample: false,
    error: null,
    missing: false,
    catalog: {
      shows: (shows.data ?? []).map((row) => mapShow({ ...row, artists: artistsByEvent.get(row.id) ?? [] })),
      artists: (artists.data ?? []).map(mapArtist),
      specials: (specials.data ?? []).map(mapSpecial).filter((row) => row !== null),
      menu: (menu.data ?? []).map(mapMenuItem),
      merch: (merch.data ?? []).map(mapMerch).filter((row) => row !== null),
      recordings: (recordings.data ?? []).flatMap((row) =>
        row.playback_id ? [mapRecording({ ...row, playback_id: row.playback_id })] : [],
      ),
    },
  };
}

type OrderItemRow = {
  product_id: string | null;
  name_snapshot: string;
  quantity: number;
  unit_price_cents: number;
};

function rowToOrder(row: {
  id: string;
  venue_id: string;
  status: StoredOrder["status"];
  customer_email: string;
  customer_name: string | null;
  total_cents: number;
  currency: string;
  access_token: string;
  checkout_mode: "test" | "stripe";
  checkout_url: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  idempotency_key: string | null;
  created_at: string;
  merch_order_items?: OrderItemRow[] | null;
}, items?: OrderItemRow[]): StoredOrder {
  const lines = items ?? row.merch_order_items ?? [];
  return {
    id: row.id,
    venueId: row.venue_id,
    status: row.status,
    email: row.customer_email,
    name: row.customer_name,
    totalCents: row.total_cents,
    currency: "usd",
    accessToken: row.access_token,
    checkoutMode: row.checkout_mode,
    checkoutUrl: row.checkout_url ?? "",
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
    items: lines.map((item) => ({
      productId: item.product_id ?? "",
      name: item.name_snapshot,
      quantity: item.quantity,
      unitPriceCents: item.unit_price_cents,
    })),
  };
}

export function databaseOrderStore(): OrderStore | null {
  const client = createServiceRoleClient();
  if (!client) return null;
  const venueId = FLO_BAMA_VENUE_ID;
  return {
    async put(order) {
      const { error } = await client.from("merch_orders").insert({
        id: order.id,
        venue_id: order.venueId,
        status: order.status,
        customer_email: order.email,
        customer_name: order.name,
        total_cents: order.totalCents,
        currency: order.currency,
        access_token: order.accessToken,
        checkout_mode: order.checkoutMode,
        checkout_url: order.checkoutUrl,
        stripe_checkout_session_id: order.stripeCheckoutSessionId,
        stripe_payment_intent_id: order.stripePaymentIntentId,
        idempotency_key: order.idempotencyKey,
        created_at: order.createdAt,
      });
      if (error) {
        if (order.idempotencyKey && /duplicate|unique/i.test(error.message)) return;
        throw new Error(error.message);
      }
      if (order.items.length === 0) return;
      const { error: itemError } = await client.from("merch_order_items").insert(
        order.items.map((item) => ({
          order_id: order.id,
          venue_id: order.venueId,
          product_id: item.productId || null,
          name_snapshot: item.name,
          quantity: item.quantity,
          unit_price_cents: item.unitPriceCents,
        })),
      );
      if (itemError) throw new Error(itemError.message);
    },
    async get(id) {
      return readOrder(client, id, venueId);
    },
    async findByIdempotency(key) {
      const { data, error } = await client
        .from("merch_orders")
        .select("*")
        .eq("venue_id", venueId)
        .eq("idempotency_key", key)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return readOrder(client, data.id, venueId);
    },
    async markPaid(id, paymentIntentId) {
      const { error } = await client
        .from("merch_orders")
        .update({ status: "paid", stripe_payment_intent_id: paymentIntentId })
        .eq("id", id)
        .eq("venue_id", venueId)
        .eq("status", "pending");
      if (error) throw new Error(error.message);
      return readOrder(client, id, venueId);
    },
  };
}

async function readOrder(
  client: NonNullable<ReturnType<typeof createServiceRoleClient>>,
  id: string,
  venueId: string,
): Promise<StoredOrder | null> {
  const { data, error } = await client.from("merch_orders").select("*").eq("id", id).eq("venue_id", venueId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const items = await client.from("merch_order_items").select("*").eq("order_id", id);
  if (items.error) throw new Error(items.error.message);
  return rowToOrder(data, items.data ?? []);
}

export async function customerOrderStore(): Promise<{ store: OrderStore; sample: boolean } | { error: string; missing: boolean }> {
  if (customerFixturesEnabled()) return { store: memoryOrderStore(), sample: true };
  const store = databaseOrderStore();
  if (!store) return { error: "Order storage is not configured.", missing: false };
  return { store, sample: false };
}

export function linesFromOrder(items: PricedLine[]) {
  return items.map((item) => ({ productId: item.productId, quantity: item.quantity }));
}
