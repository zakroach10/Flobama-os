"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStaffContext } from "@/lib/auth/staff";
import { authorizeStaffAdmin } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  getSpotOnCentralCredentials,
  getSpotOnRestaurantExportCredentials,
} from "@/lib/spoton/credentials";
import { testRestaurantExportConnection } from "@/lib/spoton/client/restaurant-export";
import { testCentralConnection } from "@/lib/spoton/client/central";
import { syncOrdersWindow } from "@/lib/spoton/sync/orders";
import { syncCentralMenus } from "@/lib/spoton/sync/menus";
import { processWebhookInboxBatch, replayWebhookEvent } from "@/lib/spoton/jobs/webhook-processor";
import { SPOTON_API_PRODUCTS, SPOTON_REPORTING_BUCKETS } from "@/lib/spoton/types";

async function adminGate() {
  const context = await getStaffContext();
  if (context.status !== "ok") {
    return { ok: false as const, message: "Sign in required." };
  }
  const allowed = authorizeStaffAdmin(context.role);
  if (!allowed.allowed) return { ok: false as const, message: allowed.reason };
  const admin = createServiceRoleClient();
  if (!admin) return { ok: false as const, message: "Service role is not configured." };
  return { ok: true as const, context, admin };
}

const settingsSchema = z.object({
  apiProduct: z.enum(SPOTON_API_PRODUCTS),
  locationId: z.string().trim().max(120).optional().nullable(),
  businessDayCutoffLocal: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Use HH:MM")
    .optional(),
  eventWindowPreMinutes: z.coerce.number().int().min(0).max(720).optional(),
  eventWindowPostMinutes: z.coerce.number().int().min(0).max(720).optional(),
  syncEnabled: z.boolean().optional(),
  publishMappedMenu: z.boolean().optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function updateSpotOnSettingsAction(input: z.infer<typeof settingsSchema>) {
  const gate = await adminGate();
  if (!gate.ok) return gate;
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: parsed.error.issues[0]?.message ?? "Invalid settings" };

  const locationId = parsed.data.locationId?.trim() || null;
  const patch: {
    venue_id: string;
    api_product: typeof parsed.data.apiProduct;
    location_id: string | null;
    business_day_cutoff_local?: string;
    event_window_pre_minutes?: number;
    event_window_post_minutes?: number;
    sync_enabled?: boolean;
    publish_mapped_menu?: boolean;
    notes?: string | null;
  } = {
    venue_id: gate.context.venue.id,
    api_product: parsed.data.apiProduct,
    location_id: locationId,
  };
  if (parsed.data.businessDayCutoffLocal) {
    patch.business_day_cutoff_local = `${parsed.data.businessDayCutoffLocal}:00`;
  }
  if (parsed.data.eventWindowPreMinutes !== undefined) {
    patch.event_window_pre_minutes = parsed.data.eventWindowPreMinutes;
  }
  if (parsed.data.eventWindowPostMinutes !== undefined) {
    patch.event_window_post_minutes = parsed.data.eventWindowPostMinutes;
  }
  if (parsed.data.syncEnabled !== undefined) patch.sync_enabled = parsed.data.syncEnabled;
  if (parsed.data.publishMappedMenu !== undefined) {
    patch.publish_mapped_menu = parsed.data.publishMappedMenu;
  }
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes;
  const { error } = await gate.admin.from("spoton_settings").upsert(patch);
  if (error) return { ok: false as const, message: error.message };

  revalidatePath("/settings");
  revalidatePath("/sales");
  return { ok: true as const, message: "SpotOn settings saved." };
}

export async function testSpotOnConnectionAction() {
  const gate = await adminGate();
  if (!gate.ok) return gate;

  const { data: settings } = await gate.admin
    .from("spoton_settings")
    .select("*")
    .eq("venue_id", gate.context.venue.id)
    .maybeSingle();

  const apiProduct = settings?.api_product ?? "none";
  const checkedAt = new Date().toISOString();
  let reportingStatus = settings?.reporting_status ?? "not_configured";
  let menuStatus = settings?.menu_status ?? "not_configured";
  let message = "No API product selected";
  let ok = false;

  if (apiProduct === "restaurant_export") {
    const result = await testRestaurantExportConnection(getSpotOnRestaurantExportCredentials());
    ok = result.ok;
    message = result.message;
    if (result.statusCode === 403) reportingStatus = "permission_denied";
    else if (result.ok) reportingStatus = "verified";
    else if (getSpotOnRestaurantExportCredentials()) reportingStatus = "configured_unverified";
    else reportingStatus = "not_configured";
  } else if (apiProduct === "central_api") {
    const result = await testCentralConnection(getSpotOnCentralCredentials());
    ok = result.ok;
    message = result.message;
    if (result.reporting) reportingStatus = "verified";
    else if (result.statusCode === 403) reportingStatus = "permission_denied";
    else if (getSpotOnCentralCredentials()) reportingStatus = "configured_unverified";
    else reportingStatus = "not_configured";
    if (result.menu) menuStatus = "verified";
    else if (getSpotOnCentralCredentials()) menuStatus = menuStatus === "verified" ? "verified" : "configured_unverified";
    else menuStatus = "not_configured";
  }

  await gate.admin
    .from("spoton_settings")
    .update({
      last_connection_test_at: checkedAt,
      last_connection_test_ok: ok,
      last_connection_test_message: message.slice(0, 500),
      reporting_status: reportingStatus,
      menu_status: menuStatus,
    })
    .eq("venue_id", gate.context.venue.id);

  await gate.admin.from("spoton_sync_runs").insert({
    venue_id: gate.context.venue.id,
    kind: "connection_test",
    api_product: apiProduct,
    status: ok ? "succeeded" : "failed",
    requested_by: gate.context.userId,
    started_at: checkedAt,
    finished_at: checkedAt,
    error_safe: ok ? null : message.slice(0, 500),
  });

  revalidatePath("/settings");
  revalidatePath("/sales");
  return { ok, message };
}

export async function runSpotOnManualSyncAction() {
  const gate = await adminGate();
  if (!gate.ok) return gate;
  const { data: settings } = await gate.admin
    .from("spoton_settings")
    .select("api_product")
    .eq("venue_id", gate.context.venue.id)
    .maybeSingle();
  if (!settings || settings.api_product === "none") {
    return { ok: false as const, message: "Select and verify a reporting API product first." };
  }
  const now = new Date();
  const start = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  try {
    const result = await syncOrdersWindow({
      admin: gate.admin,
      venueId: gate.context.venue.id,
      apiProduct: settings.api_product,
      windowStart: start,
      windowEnd: now,
      kind: "manual_orders",
      requestedBy: gate.context.userId,
    });
    revalidatePath("/sales");
    revalidatePath("/settings");
    return {
      ok: true as const,
      message: `Synced ${result.upserted} order(s); skipped ${result.skipped}.`,
    };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Manual sync failed",
    };
  }
}

const backfillSchema = z.object({
  startIso: z.string().datetime({ offset: true }),
  endIso: z.string().datetime({ offset: true }),
});

export async function runSpotOnBackfillAction(input: z.infer<typeof backfillSchema>) {
  const gate = await adminGate();
  if (!gate.ok) return gate;
  const parsed = backfillSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Provide valid start/end timestamps." };
  const start = new Date(parsed.data.startIso);
  const end = new Date(parsed.data.endIso);
  if (end <= start) return { ok: false as const, message: "End must be after start." };
  if (end.getTime() - start.getTime() > 14 * 24 * 60 * 60 * 1000) {
    return { ok: false as const, message: "Backfill range capped at 14 days per request." };
  }

  const { data: settings } = await gate.admin
    .from("spoton_settings")
    .select("api_product")
    .eq("venue_id", gate.context.venue.id)
    .maybeSingle();
  if (!settings || settings.api_product === "none") {
    return { ok: false as const, message: "Select and verify a reporting API product first." };
  }

  try {
    const result = await syncOrdersWindow({
      admin: gate.admin,
      venueId: gate.context.venue.id,
      apiProduct: settings.api_product,
      windowStart: start,
      windowEnd: end,
      kind: "backfill_orders",
      requestedBy: gate.context.userId,
    });
    revalidatePath("/sales");
    revalidatePath("/settings");
    return {
      ok: true as const,
      message: `Backfill upserted ${result.upserted}; skipped ${result.skipped}; windows ${result.windows}.`,
    };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Backfill failed",
    };
  }
}

export async function runSpotOnMenuSyncAction() {
  const gate = await adminGate();
  if (!gate.ok) return gate;
  if (!getSpotOnCentralCredentials()) {
    return {
      ok: false as const,
      message: "Menu sync requires Central API OAuth credentials (menu:all:read).",
    };
  }
  try {
    const result = await syncCentralMenus({
      admin: gate.admin,
      venueId: gate.context.venue.id,
      requestedBy: gate.context.userId,
    });
    revalidatePath("/settings");
    revalidatePath("/sales");
    return { ok: true as const, message: `Synced ${result.menus} menu(s), ${result.items} item(s).` };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Menu sync failed",
    };
  }
}

export async function processSpotOnWebhookQueueAction() {
  const gate = await adminGate();
  if (!gate.ok) return gate;
  try {
    const result = await processWebhookInboxBatch({
      admin: gate.admin,
      venueId: gate.context.venue.id,
    });
    revalidatePath("/settings");
    return {
      ok: true as const,
      message: `Processed ${result.processed}, ignored ${result.ignored}, failed ${result.failed}.`,
    };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Queue processing failed",
    };
  }
}

export async function replaySpotOnWebhookAction(inboxId: string) {
  const gate = await adminGate();
  if (!gate.ok) return gate;
  const result = await replayWebhookEvent({
    admin: gate.admin,
    venueId: gate.context.venue.id,
    inboxId,
    requestedBy: gate.context.userId,
  });
  if (!result.ok) return result;
  await processWebhookInboxBatch({ admin: gate.admin, venueId: gate.context.venue.id, limit: 5 });
  revalidatePath("/settings");
  return { ok: true as const, message: "Webhook queued for replay." };
}

const categorySchema = z.object({
  externalCategoryName: z.string().trim().min(1).max(200),
  externalCategoryId: z.string().trim().max(120).optional().nullable(),
  reportingBucket: z.enum(SPOTON_REPORTING_BUCKETS),
});

export async function upsertSpotOnCategoryMappingAction(input: z.infer<typeof categorySchema>) {
  const gate = await adminGate();
  if (!gate.ok) return gate;
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Invalid category mapping." };
  const { error } = await gate.admin.from("spoton_category_mappings").upsert(
    {
      venue_id: gate.context.venue.id,
      external_category_name: parsed.data.externalCategoryName,
      external_category_id: parsed.data.externalCategoryId ?? null,
      reporting_bucket: parsed.data.reportingBucket,
    },
    { onConflict: "venue_id,external_category_name" },
  );
  if (error) return { ok: false as const, message: error.message };
  revalidatePath("/sales");
  revalidatePath("/settings");
  return { ok: true as const, message: "Category mapping saved." };
}

const bookingCostSchema = z.object({
  eventId: z.string().uuid(),
  bookingCostCents: z.number().int().min(0).nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export async function updateEventBookingCostAction(input: z.infer<typeof bookingCostSchema>) {
  const gate = await adminGate();
  if (!gate.ok) return gate;
  const parsed = bookingCostSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Invalid booking cost." };
  const { error } = await gate.admin
    .from("events")
    .update({
      booking_cost_cents: parsed.data.bookingCostCents,
      booking_cost_notes: parsed.data.notes ?? null,
    })
    .eq("id", parsed.data.eventId)
    .eq("venue_id", gate.context.venue.id);
  if (error) return { ok: false as const, message: error.message };
  revalidatePath("/sales");
  revalidatePath("/programming");
  return { ok: true as const, message: "Booking cost updated." };
}
