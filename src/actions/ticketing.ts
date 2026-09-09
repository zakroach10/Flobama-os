"use server";

import { revalidatePath } from "next/cache";
import { getStaffContext } from "@/lib/auth/staff";
import { authorizeProgramming } from "@/lib/auth/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { MASTER_LAYOUT_ID } from "@/lib/ticketing/constants";
import { checkInDemoOrder, getDemoOrder, getDemoOrderByQr } from "@/lib/ticketing/memory-store";
import { dollarsToCents } from "@/lib/ticketing/money";
import { newQrToken } from "@/lib/ticketing/tokens";
import { z } from "zod";

export type TicketingActionResult = {
  ok: boolean;
  message: string;
};

async function staffGate() {
  const context = await getStaffContext();
  if (context.status !== "ok") return { ok: false as const, message: "Sign in required." };
  const allowed = authorizeProgramming(context.role);
  if (!allowed.allowed) return { ok: false as const, message: allowed.reason };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { ok: false as const, message: "Supabase is not configured." };
  return { ok: true as const, context, supabase };
}

function revalidateTicketing(eventId?: string) {
  revalidatePath("/ticketing");
  revalidatePath("/ticketing/events");
  revalidatePath("/ticketing/orders");
  revalidatePath("/ticketing/layout");
  revalidatePath("/ticketing/reports");
  if (eventId) {
    revalidatePath(`/events/${eventId}`);
    revalidatePath(`/ticketing/check-in/${eventId}`);
    revalidatePath(`/tickets/${eventId}`);
  }
}

export async function enableEventTicketingAction(eventId: string, enabled: boolean): Promise<TicketingActionResult> {
  const gate = await staffGate();
  if (!gate.ok) return gate;
  const { error } = await gate.supabase.from("event_ticketing" as never).upsert({
    event_id: eventId,
    venue_id: gate.context.venue.id,
    enabled,
  } as never);
  if (error) return { ok: false, message: error.message };
  if (enabled) {
    await snapshotEventLayoutAction(eventId);
    const { data: existingTypes } = await gate.supabase
      .from("ticket_types" as never)
      .select("id")
      .eq("event_id", eventId)
      .limit(1);
    if (!existingTypes || existingTypes.length === 0) {
      await gate.supabase.from("ticket_types" as never).insert([
        {
          event_id: eventId,
          venue_id: gate.context.venue.id,
          name: "General Admission",
          description: "Standing room and dance floor. First come, first served at the door.",
          kind: "ga",
          price_cents: 2000,
          quantity: 250,
          max_per_order: 8,
          sort_order: 0,
        },
        {
          event_id: eventId,
          venue_id: gate.context.venue.id,
          name: "VIP Admission",
          description: "Priority entry and VIP rail. Does not include a reserved table.",
          kind: "vip",
          price_cents: 4000,
          quantity: 50,
          max_per_order: 6,
          sort_order: 1,
        },
      ] as never);
    }
  }
  await gate.supabase
    .from("events")
    .update({
      is_ticketed: enabled,
      ticket_url: enabled ? `/tickets/${eventId}` : null,
    })
    .eq("id", eventId);
  revalidateTicketing(eventId);
  return {
    ok: true,
    message: enabled
      ? "Ticketing enabled. General admission and VIP types are ready, and the table map was copied from the main room."
      : "Ticketing disabled. The event still exists as a regular calendar record.",
  };
}

export async function saveTicketingSettingsAction(eventId: string, input: unknown): Promise<TicketingActionResult> {
  const gate = await staffGate();
  if (!gate.ok) return gate;
  const parsed = z
    .object({
      doorsAt: z.string().optional().nullable(),
      capacity: z.string().optional().nullable(),
      salesStart: z.string().optional().nullable(),
      salesEnd: z.string().optional().nullable(),
      maxTicketsPerOrder: z.coerce.number().int().min(1).max(50),
      holdMinutes: z.coerce.number().int().min(2).max(30),
      tablesEnabled: z.boolean(),
      refundsEnabled: z.boolean(),
      refundPolicy: z.string().max(4000).optional().nullable(),
      ageRestriction: z.string().max(120).optional().nullable(),
      parkingNotes: z.string().max(2000).optional().nullable(),
      venueNotes: z.string().max(4000).optional().nullable(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid settings." };
  const v = parsed.data;
  const { error } = await gate.supabase.from("event_ticketing" as never).upsert({
    event_id: eventId,
    venue_id: gate.context.venue.id,
    enabled: true,
    doors_at: v.doorsAt || null,
    capacity: v.capacity ? Number(v.capacity) : null,
    sales_start: v.salesStart || null,
    sales_end: v.salesEnd || null,
    max_tickets_per_order: v.maxTicketsPerOrder,
    hold_minutes: v.holdMinutes,
    tables_enabled: v.tablesEnabled,
    refunds_enabled: v.refundsEnabled,
    refund_policy: v.refundPolicy || null,
    age_restriction: v.ageRestriction || null,
    parking_notes: v.parkingNotes || null,
    venue_notes: v.venueNotes || null,
  } as never);
  if (error) return { ok: false, message: error.message };
  revalidateTicketing(eventId);
  return { ok: true, message: "Ticketing settings saved." };
}

export async function saveTicketTypeAction(eventId: string, input: unknown, typeId?: string): Promise<TicketingActionResult> {
  const gate = await staffGate();
  if (!gate.ok) return gate;
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(80),
      description: z.string().max(500).optional().nullable(),
      kind: z.enum(["ga", "vip", "other"]),
      price: z.string(),
      quantity: z.coerce.number().int().min(0).max(20000),
      blockedQuantity: z.coerce.number().int().min(0).max(20000),
      maxPerOrder: z.coerce.number().int().min(1).max(50),
      active: z.boolean(),
      visibility: z.enum(["public", "hidden"]),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid ticket type." };
  const price = dollarsToCents(parsed.data.price);
  if (price == null) return { ok: false, message: "Enter a valid price." };
  const row = {
    event_id: eventId,
    venue_id: gate.context.venue.id,
    name: parsed.data.name,
    description: parsed.data.description || null,
    kind: parsed.data.kind,
    price_cents: price,
    quantity: parsed.data.quantity,
    blocked_quantity: parsed.data.blockedQuantity,
    max_per_order: parsed.data.maxPerOrder,
    active: parsed.data.active,
    visibility: parsed.data.visibility,
  };
  const query = typeId
    ? gate.supabase.from("ticket_types" as never).update(row as never).eq("id", typeId)
    : gate.supabase.from("ticket_types" as never).insert(row as never);
  const { error } = await query;
  if (error) return { ok: false, message: error.message };
  revalidateTicketing(eventId);
  return { ok: true, message: typeId ? "Ticket type updated." : "Ticket type added." };
}

export async function snapshotEventLayoutAction(eventId: string, layoutId = MASTER_LAYOUT_ID): Promise<TicketingActionResult> {
  const gate = await staffGate();
  if (!gate.ok) return gate;
  const { data: layout, error: layoutError } = await gate.supabase
    .from("venue_layouts" as never)
    .select("*")
    .eq("id", layoutId)
    .maybeSingle();
  if (layoutError) return { ok: false, message: layoutError.message };
  if (!layout) return { ok: false, message: "Master venue layout is missing." };
  const { data: objects, error: objectsError } = await gate.supabase
    .from("venue_layout_objects" as never)
    .select("*")
    .eq("layout_id", layoutId);
  if (objectsError) return { ok: false, message: objectsError.message };

  const { data: existing } = await gate.supabase.from("event_layouts" as never).select("id").eq("event_id", eventId).maybeSingle();
  if (existing) {
    return { ok: true, message: "This event already has its own table map." };
  }

  const layoutRow = layout as { canvas_width: number; canvas_height: number };
  const { data: created, error: createError } = await gate.supabase
    .from("event_layouts" as never)
    .insert({
      event_id: eventId,
      venue_id: gate.context.venue.id,
      source_layout_id: layoutId,
      canvas_width: layoutRow.canvas_width,
      canvas_height: layoutRow.canvas_height,
    } as never)
    .select("id")
    .single();
  if (createError || !created) return { ok: false, message: createError?.message ?? "Could not copy layout." };
  const eventLayoutId = (created as { id: string }).id;
  const copies = ((objects ?? []) as Array<Record<string, unknown>>).map((object) => ({
    event_layout_id: eventLayoutId,
    event_id: eventId,
    venue_id: gate.context.venue.id,
    source_object_id: object.id,
    object_type: object.object_type,
    name: object.name,
    capacity: object.capacity,
    x_position: object.x_position,
    y_position: object.y_position,
    width: object.width,
    height: object.height,
    rotation: object.rotation,
    shape: object.shape,
    table_number: object.table_number,
    section: object.section,
    price_cents: object.default_price_cents,
    sellable: object.sellable,
    vip: object.section === "VIP",
    status: object.sellable ? "available" : "unavailable",
    sort_order: object.sort_order,
  }));
  if (copies.length > 0) {
    const { error } = await gate.supabase.from("event_layout_objects" as never).insert(copies as never);
    if (error) return { ok: false, message: error.message };
  }
  await gate.supabase.from("event_ticketing" as never).upsert({
    event_id: eventId,
    venue_id: gate.context.venue.id,
    source_layout_id: layoutId,
  } as never);
  revalidateTicketing(eventId);
  return { ok: true, message: "Event table map copied from the main room." };
}

export async function saveVenueLayoutObjectsAction(
  layoutId: string,
  objects: Array<Record<string, unknown>>,
): Promise<TicketingActionResult> {
  const gate = await staffGate();
  if (!gate.ok) return gate;
  for (const object of objects) {
    if (!object.id) continue;
    const { error } = await gate.supabase
      .from("venue_layout_objects" as never)
      .update({
        x_position: object.x_position,
        y_position: object.y_position,
        width: object.width,
        height: object.height,
        rotation: object.rotation,
        name: object.name,
        capacity: object.capacity,
        sellable: object.sellable,
        default_price_cents: object.default_price_cents,
        section: object.section,
      } as never)
      .eq("id", object.id as string);
    if (error) return { ok: false, message: error.message };
  }
  revalidateTicketing();
  return { ok: true, message: "Venue layout saved." };
}

export async function saveEventLayoutObjectsAction(
  eventId: string,
  objects: Array<Record<string, unknown>>,
): Promise<TicketingActionResult> {
  const gate = await staffGate();
  if (!gate.ok) return gate;
  for (const object of objects) {
    if (!object.id) continue;
    const { error } = await gate.supabase
      .from("event_layout_objects" as never)
      .update({
        x_position: object.x_position,
        y_position: object.y_position,
        width: object.width,
        height: object.height,
        name: object.name,
        capacity: object.capacity,
        price_cents: object.price_cents,
        sellable: object.sellable,
        vip: object.vip,
        section: object.section,
      } as never)
      .eq("id", object.id as string)
      .eq("event_id", eventId);
    if (error) return { ok: false, message: error.message };
  }
  revalidateTicketing(eventId);
  return { ok: true, message: "Show layout saved." };
}

export async function setEventTableStatusAction(
  eventId: string,
  objectId: string,
  status: "available" | "blocked" | "comp" | "unavailable" | "held",
): Promise<TicketingActionResult> {
  const gate = await staffGate();
  if (!gate.ok) return gate;
  const { data: current } = await gate.supabase
    .from("event_layout_objects" as never)
    .select("status")
    .eq("id", objectId)
    .maybeSingle();
  const currentStatus = (current as { status?: string } | null)?.status;
  if (currentStatus === "sold") return { ok: false, message: "Sold tables must be refunded before they can change status." };
  const { error } = await gate.supabase
    .from("event_layout_objects" as never)
    .update({
      status,
      hold_session: null,
      hold_until: null,
    } as never)
    .eq("id", objectId)
    .eq("event_id", eventId);
  if (error) return { ok: false, message: error.message };
  revalidateTicketing(eventId);
  return { ok: true, message: `Table marked ${status}.` };
}

export async function deleteTicketTypeAction(eventId: string, typeId: string): Promise<TicketingActionResult> {
  const gate = await staffGate();
  if (!gate.ok) return gate;
  const { count } = await gate.supabase
    .from("tickets" as never)
    .select("id", { count: "exact", head: true })
    .eq("ticket_type_id", typeId);
  if ((count ?? 0) > 0) return { ok: false, message: "This type already has sold tickets. Deactivate it instead." };
  const { error } = await gate.supabase.from("ticket_types" as never).delete().eq("id", typeId).eq("event_id", eventId);
  if (error) return { ok: false, message: error.message };
  revalidateTicketing(eventId);
  return { ok: true, message: "Ticket type removed." };
}

export async function addEventTableAction(eventId: string): Promise<TicketingActionResult> {
  const gate = await staffGate();
  if (!gate.ok) return gate;
  const { data: layout } = await gate.supabase.from("event_layouts" as never).select("id").eq("event_id", eventId).maybeSingle();
  if (!layout) return { ok: false, message: "Copy the master layout onto this event first." };
  const { data: objects } = await gate.supabase
    .from("event_layout_objects" as never)
    .select("table_number, sort_order")
    .eq("event_id", eventId);
  const numbers = ((objects ?? []) as Array<{ table_number: string | null; sort_order: number }>)
    .map((row) => Number.parseInt(row.table_number ?? "", 10))
    .filter((n) => Number.isFinite(n));
  const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
  const { error } = await gate.supabase.from("event_layout_objects" as never).insert({
    event_layout_id: (layout as { id: string }).id,
    event_id: eventId,
    venue_id: gate.context.venue.id,
    object_type: "table",
    name: `Table ${next}`,
    capacity: 4,
    x_position: 40,
    y_position: 40,
    width: 88,
    height: 64,
    shape: "round",
    table_number: String(next),
    section: "Main floor",
    price_cents: 15000,
    sellable: true,
    vip: false,
    status: "available",
    sort_order: 100 + next,
  } as never);
  if (error) return { ok: false, message: error.message };
  revalidateTicketing(eventId);
  return { ok: true, message: `Table ${next} added to this show only.` };
}

export async function checkInTicketAction(ticketIdOrToken: string, quantity: number): Promise<TicketingActionResult> {
  const gate = await staffGate();
  if (!gate.ok) return gate;
  const demoOrder = getDemoOrderByQr(ticketIdOrToken) ?? getDemoOrder(ticketIdOrToken);
  if (demoOrder) {
    const result = checkInDemoOrder(demoOrder.id, quantity);
    if (!result.ok) return { ok: false, message: result.error };
    revalidatePath("/ticketing/check-in");
    revalidatePath(`/ticketing/check-in/${demoOrder.eventId}`);
    return { ok: true, message: `Checked in. ${result.order.admissionsCheckedIn} / ${result.order.admissionsTotal}.` };
  }

  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, message: "Service role is required for check-in." };
  let ticketId = ticketIdOrToken;
  const { data: byToken } = await admin.from("tickets" as never).select("id").eq("qr_token", ticketIdOrToken).maybeSingle();
  if (byToken) ticketId = String((byToken as { id: string }).id);
  const { data, error } = await admin.rpc("check_in_ticket" as never, {
    p_ticket_id: ticketId,
    p_quantity: quantity,
    p_staff: gate.context.userId,
  } as never);
  if (error) return { ok: false, message: error.message };
  const result = data as { ok?: boolean; error?: string; checkedIn?: number; total?: number };
  if (result && result.ok === false) return { ok: false, message: result.error ?? "Check-in failed." };
  revalidatePath("/ticketing/check-in");
  return {
    ok: true,
    message: result?.total != null ? `Checked in. ${result.checkedIn} / ${result.total}.` : "Checked in.",
  };
}

export async function refundOrderAction(orderId: string, reason: string): Promise<TicketingActionResult> {
  const gate = await staffGate();
  if (!gate.ok) return gate;
  const { data: order, error } = await gate.supabase.from("ticketing_orders" as never).select("*").eq("id", orderId).maybeSingle();
  if (error || !order) return { ok: false, message: error?.message ?? "Order not found." };
  const row = order as { id: string; venue_id: string; event_id: string; total_cents: number; order_status: string };
  if (row.order_status === "refunded") return { ok: false, message: "Already refunded." };
  await gate.supabase.from("ticketing_refunds" as never).insert({
    order_id: row.id,
    venue_id: row.venue_id,
    amount_cents: row.total_cents,
    status: "succeeded",
    reason: reason || "Staff refund",
    created_by: gate.context.userId,
  } as never);
  await gate.supabase
    .from("ticketing_orders" as never)
    .update({ order_status: "refunded", payment_status: "refunded" } as never)
    .eq("id", row.id);
  await gate.supabase.from("tickets" as never).update({ status: "refunded" } as never).eq("order_id", row.id);
  await gate.supabase
    .from("event_layout_objects" as never)
    .update({ status: "available", sold_order_id: null, hold_session: null, hold_until: null } as never)
    .eq("sold_order_id", row.id);
  revalidateTicketing(row.event_id);
  return { ok: true, message: "Order refunded and inventory released." };
}

export async function issueCompTableAction(eventId: string, objectId: string, guestName: string): Promise<TicketingActionResult> {
  return staffIssueTableAction({ eventId, objectId, guestName, email: "comp@flobama.local", mode: "comp" });
}

export async function staffIssueTableAction(input: {
  eventId: string;
  objectId: string;
  guestName: string;
  email?: string;
  phone?: string;
  mode: "comp" | "manual";
}): Promise<TicketingActionResult> {
  const gate = await staffGate();
  if (!gate.ok) return gate;
  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, message: "Service role is required for door sales." };
  const { data: table, error: tableError } = await admin
    .from("event_layout_objects" as never)
    .select("*")
    .eq("id", input.objectId)
    .eq("event_id", input.eventId)
    .maybeSingle();
  if (tableError || !table) return { ok: false, message: tableError?.message ?? "Table not found." };
  const row = table as {
    id: string;
    name: string;
    capacity: number;
    price_cents: number | null;
    status: string;
    venue_id: string;
  };
  if (row.status === "sold") return { ok: false, message: "That table is already sold." };

  const names = input.guestName.trim().split(/\s+/);
  const firstName = names[0] || "Guest";
  const lastName = names.slice(1).join(" ") || "List";
  const orderId = crypto.randomUUID();
  const orderNumber = `FB-STAFF-${newQrToken().slice(0, 6).toUpperCase()}`;
  const price = input.mode === "comp" ? 0 : (row.price_cents ?? 0);
  const admissions = Math.max(1, row.capacity);
  const { error: orderError } = await admin.from("ticketing_orders" as never).insert({
    id: orderId,
    venue_id: row.venue_id,
    event_id: input.eventId,
    order_number: orderNumber,
    first_name: firstName,
    last_name: lastName,
    email: (input.email || "door@flobama.local").toLowerCase(),
    phone: input.phone || null,
    subtotal_cents: price,
    fees_cents: 0,
    tax_cents: 0,
    total_cents: price,
    payment_status: "succeeded",
    order_status: "paid",
    provider: "manual",
    provider_ref: input.mode === "comp" ? "comp" : "door-sale",
  } as never);
  if (orderError) return { ok: false, message: orderError.message };

  const { data: item, error: itemError } = await admin
    .from("ticketing_order_items" as never)
    .insert({
      order_id: orderId,
      event_id: input.eventId,
      kind: input.mode === "comp" ? "comp" : "table",
      layout_object_id: row.id,
      name: row.name,
      quantity: 1,
      unit_price_cents: price,
      admissions,
    } as never)
    .select("id")
    .single();
  if (itemError || !item) return { ok: false, message: itemError?.message ?? "Could not add order item." };

  const { error: ticketError } = await admin.from("tickets" as never).insert({
    order_id: orderId,
    order_item_id: (item as { id: string }).id,
    event_id: input.eventId,
    venue_id: row.venue_id,
    layout_object_id: row.id,
    qr_token: newQrToken(),
    purchaser_name: `${firstName} ${lastName}`.trim(),
    admissions_total: admissions,
  } as never);
  if (ticketError) return { ok: false, message: ticketError.message };

  const { error: statusError } = await admin
    .from("event_layout_objects" as never)
    .update({
      status: input.mode === "comp" ? "comp" : "sold",
      sold_order_id: orderId,
      hold_session: null,
      hold_until: null,
    } as never)
    .eq("id", row.id)
    .eq("event_id", input.eventId);
  if (statusError) return { ok: false, message: statusError.message };

  revalidateTicketing(input.eventId);
  return {
    ok: true,
    message:
      input.mode === "comp"
        ? `${row.name} comped for ${firstName} ${lastName}. QR ticket created (${orderNumber}).`
        : `${row.name} sold at the door for ${firstName} ${lastName} (${orderNumber}).`,
  };
}

export async function moveTableReservationAction(
  eventId: string,
  fromObjectId: string,
  toObjectId: string,
): Promise<TicketingActionResult> {
  const gate = await staffGate();
  if (!gate.ok) return gate;
  const { data: from } = await gate.supabase
    .from("event_layout_objects" as never)
    .select("id, status, sold_order_id, name")
    .eq("id", fromObjectId)
    .eq("event_id", eventId)
    .maybeSingle();
  const { data: to } = await gate.supabase
    .from("event_layout_objects" as never)
    .select("id, status, name")
    .eq("id", toObjectId)
    .eq("event_id", eventId)
    .maybeSingle();
  const source = from as { id: string; status: string; sold_order_id: string | null; name: string } | null;
  const target = to as { id: string; status: string; name: string } | null;
  if (!source || !target) return { ok: false, message: "Both tables must exist on this event." };
  if (!source.sold_order_id || (source.status !== "sold" && source.status !== "comp")) {
    return { ok: false, message: "The source table does not have a reservation to move." };
  }
  if (target.status !== "available") return { ok: false, message: "The destination table is not available." };

  const { error: toError } = await gate.supabase
    .from("event_layout_objects" as never)
    .update({ status: source.status, sold_order_id: source.sold_order_id } as never)
    .eq("id", target.id)
    .eq("status", "available");
  if (toError) return { ok: false, message: toError.message };
  await gate.supabase
    .from("event_layout_objects" as never)
    .update({ status: "available", sold_order_id: null, hold_session: null, hold_until: null } as never)
    .eq("id", source.id);
  await gate.supabase
    .from("tickets" as never)
    .update({ layout_object_id: target.id } as never)
    .eq("layout_object_id", source.id)
    .eq("order_id", source.sold_order_id);
  revalidateTicketing(eventId);
  return { ok: true, message: `Moved reservation from ${source.name} to ${target.name}.` };
}

export { FLO_BAMA_VENUE_ID };
