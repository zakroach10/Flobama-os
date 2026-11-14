"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStaffContext } from "@/lib/auth/staff";
import { authorizeProgramming } from "@/lib/auth/permissions";
import { CUSTOMER_MIGRATION, isMissingCustomerRelation } from "@/lib/customer/catalog";
import { dollarsToCents } from "@/lib/customer/money";
import { parsePlaybackId } from "@/lib/customer/stream";
import { CUSTOMER_ORDER_STATUSES } from "@/lib/customer/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { parseVenueLocalDateTime } from "@/lib/timezone";

export type ActionResult = { ok: boolean; message: string };

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : null));

async function gate() {
  const context = await getStaffContext();
  if (context.status !== "ok") {
    return { ok: false as const, message: context.status === "error" ? context.message : "Sign in required." };
  }
  const allowed = authorizeProgramming(context.role);
  if (!allowed.allowed) return { ok: false as const, message: allowed.reason };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { ok: false as const, message: "Supabase is not configured." };
  return { ok: true as const, context, supabase };
}

function fail(message: string): ActionResult {
  if (isMissingCustomerRelation(message)) {
    return { ok: false, message: `Apply ${CUSTOMER_MIGRATION} before saving customer app records.` };
  }
  return { ok: false, message };
}

function refresh() {
  revalidatePath("/customer");
}

const menuSchema = z.object({
  category: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(160),
  description: optionalText(500),
  priceLabel: z.string().trim().min(1).max(40),
  sortOrder: z.number().int().min(0).max(9999),
  available: z.boolean(),
});

export async function saveMenuItemAction(input: unknown, id?: string): Promise<ActionResult> {
  const gateResult = await gate();
  if (!gateResult.ok) return gateResult;
  const parsed = menuSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the menu item fields." };
  const fields = {
    category: parsed.data.category,
    name: parsed.data.name,
    description: parsed.data.description,
    price_label: parsed.data.priceLabel,
    sort_order: parsed.data.sortOrder,
    available: parsed.data.available,
  };
  const query = id
    ? gateResult.supabase.from("menu_items").update(fields).eq("id", id).eq("venue_id", gateResult.context.venue.id)
    : gateResult.supabase.from("menu_items").insert({ ...fields, venue_id: gateResult.context.venue.id });
  const { error } = await query;
  if (error) return fail(error.message);
  refresh();
  return { ok: true, message: id ? "Menu item updated." : "Menu item added." };
}

export async function archiveMenuItemAction(id: string): Promise<ActionResult> {
  const gateResult = await gate();
  if (!gateResult.ok) return gateResult;
  const { error } = await gateResult.supabase
    .from("menu_items")
    .update({ archived_at: new Date().toISOString(), available: false })
    .eq("id", id)
    .eq("venue_id", gateResult.context.venue.id);
  if (error) return fail(error.message);
  refresh();
  return { ok: true, message: "Menu item archived." };
}

const merchSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: optionalText(800),
  price: z.string().trim().min(1).max(12),
  sku: optionalText(40),
  sortOrder: z.number().int().min(0).max(9999),
  active: z.boolean(),
});

export async function saveMerchAction(input: unknown, id?: string): Promise<ActionResult> {
  const gateResult = await gate();
  if (!gateResult.ok) return gateResult;
  const parsed = merchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the merch fields." };
  const priceCents = dollarsToCents(parsed.data.price);
  if (priceCents == null) return { ok: false, message: "Enter a price from $0.50 to $1000.00." };
  const fields = {
    name: parsed.data.name,
    description: parsed.data.description,
    price_cents: priceCents,
    sku: parsed.data.sku,
    sort_order: parsed.data.sortOrder,
    active: parsed.data.active,
  };
  const query = id
    ? gateResult.supabase.from("merch_products").update(fields).eq("id", id).eq("venue_id", gateResult.context.venue.id)
    : gateResult.supabase.from("merch_products").insert({ ...fields, venue_id: gateResult.context.venue.id, currency: "usd" });
  const { error } = await query;
  if (error) return fail(error.message);
  refresh();
  return { ok: true, message: id ? "Merch updated." : "Merch added." };
}

export async function archiveMerchAction(id: string): Promise<ActionResult> {
  const gateResult = await gate();
  if (!gateResult.ok) return gateResult;
  const { error } = await gateResult.supabase
    .from("merch_products")
    .update({ archived_at: new Date().toISOString(), active: false })
    .eq("id", id)
    .eq("venue_id", gateResult.context.venue.id);
  if (error) return fail(error.message);
  refresh();
  return { ok: true, message: "Merch archived." };
}

const recordingSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: optionalText(800),
  playbackId: z.string().trim().min(1).max(300),
  eventId: optionalText(80),
  artistId: optionalText(80),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
  time: z.string().regex(/^\d{2}:\d{2}$/).or(z.literal("")),
  published: z.boolean(),
});

export async function saveRecordingAction(input: unknown, id?: string): Promise<ActionResult> {
  const gateResult = await gate();
  if (!gateResult.ok) return gateResult;
  const parsed = recordingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the recording fields." };
  const playbackId = parsePlaybackId(parsed.data.playbackId);
  if (!playbackId) return { ok: false, message: "Paste a Mux playback ID or a stream.mux.com link." };
  let recordedAt: string | null = null;
  if (parsed.data.date && parsed.data.time) {
    const local = parseVenueLocalDateTime(parsed.data.date, parsed.data.time);
    if (!local.ok) return { ok: false, message: local.message };
    recordedAt = local.iso;
  }
  const eventId = parsed.data.eventId && z.uuid().safeParse(parsed.data.eventId).success ? parsed.data.eventId : null;
  const artistId = parsed.data.artistId && z.uuid().safeParse(parsed.data.artistId).success ? parsed.data.artistId : null;
  const fields = {
    title: parsed.data.title,
    description: parsed.data.description,
    playback_id: playbackId,
    event_id: eventId,
    artist_id: artistId,
    recorded_at: recordedAt,
    published: parsed.data.published,
  };
  const query = id
    ? gateResult.supabase.from("customer_recordings").update(fields).eq("id", id).eq("venue_id", gateResult.context.venue.id)
    : gateResult.supabase.from("customer_recordings").insert({ ...fields, venue_id: gateResult.context.venue.id, provider: "mux" });
  const { error } = await query;
  if (error) return fail(error.message);
  refresh();
  return { ok: true, message: parsed.data.published ? "Recording published to the app." : "Recording saved as a draft." };
}

export async function archiveRecordingAction(id: string): Promise<ActionResult> {
  const gateResult = await gate();
  if (!gateResult.ok) return gateResult;
  const { error } = await gateResult.supabase
    .from("customer_recordings")
    .update({ archived_at: new Date().toISOString(), published: false })
    .eq("id", id)
    .eq("venue_id", gateResult.context.venue.id);
  if (error) return fail(error.message);
  refresh();
  return { ok: true, message: "Recording archived." };
}

export async function updateMerchOrderStatusAction(id: string, status: string): Promise<ActionResult> {
  const gateResult = await gate();
  if (!gateResult.ok) return gateResult;
  if (!CUSTOMER_ORDER_STATUSES.includes(status as (typeof CUSTOMER_ORDER_STATUSES)[number])) {
    return { ok: false, message: "Unknown order status." };
  }
  if (status === "pending") return { ok: false, message: "Orders cannot be moved back to pending." };
  const { error } = await gateResult.supabase
    .from("merch_orders")
    .update({ status: status as (typeof CUSTOMER_ORDER_STATUSES)[number] })
    .eq("id", id)
    .eq("venue_id", gateResult.context.venue.id);
  if (error) return fail(error.message);
  refresh();
  return { ok: true, message: "Order updated." };
}
