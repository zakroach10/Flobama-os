import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupportedWebhookCategory } from "@/lib/spoton/webhook";
import type { ParsedWebhookEvent } from "@/lib/spoton/webhook";

const MAX_ATTEMPTS = 8;
const LEASE_MS = 2 * 60 * 1000;

function backoffMs(attempt: number) {
  return Math.min(60 * 60 * 1000, 1000 * 2 ** Math.min(attempt, 10));
}

export async function persistAuthenticatedWebhook(input: {
  admin: SupabaseClient;
  venueId: string;
  event: ParsedWebhookEvent;
  rawBytes: number;
}): Promise<{ duplicate: boolean; inboxId: string }> {
  const ignore = !isSupportedWebhookCategory(input.event.category);
  const insert = await input.admin
    .from("spoton_webhook_inbox")
    .insert({
      venue_id: input.venueId,
      provider: "spoton_central",
      location_id: input.event.location_id,
      event_id: input.event.id,
      event_category: input.event.category,
      event_type: input.event.eventType,
      event_timestamp: input.event.timestamp,
      payload: input.event.sanitizedPayload,
      payload_bytes: input.rawBytes,
      signature_version: "v1",
      processing_status: ignore ? "ignored" : "pending",
      processed_at: ignore ? new Date().toISOString() : null,
      next_attempt_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insert.error) {
    if (/duplicate|unique/i.test(insert.error.message)) {
      const existing = await input.admin
        .from("spoton_webhook_inbox")
        .select("id")
        .eq("provider", "spoton_central")
        .eq("location_id", input.event.location_id)
        .eq("event_id", input.event.id)
        .maybeSingle();
      if (existing.data?.id) {
        return { duplicate: true, inboxId: existing.data.id };
      }
    }
    // Persistence failures must be retryable for the webhook sender.
    throw new Error(`Webhook persistence failed: ${insert.error.message}`);
  }

  await input.admin
    .from("spoton_settings")
    .update({
      last_webhook_at: new Date().toISOString(),
      last_webhook_event_id: input.event.id,
      webhook_status: "verified",
    })
    .eq("venue_id", input.venueId);

  if (!ignore) {
    await input.admin.from("spoton_sync_runs").insert({
      venue_id: input.venueId,
      kind: "webhook_process",
      api_product: "webhook",
      status: "queued",
      details: { inboxId: insert.data.id, eventId: input.event.id, category: input.event.category },
    });
  }

  return { duplicate: false, inboxId: insert.data.id };
}

export async function processWebhookInboxBatch(input: {
  admin: SupabaseClient;
  venueId: string;
  limit?: number;
}): Promise<{ processed: number; failed: number; ignored: number }> {
  const limit = input.limit ?? 25;
  const now = new Date();
  const leaseOwner = `webhook:${process.pid}:${now.getTime()}`;

  const { data: candidates, error } = await input.admin
    .from("spoton_webhook_inbox")
    .select("*")
    .eq("venue_id", input.venueId)
    .in("processing_status", ["pending", "failed"])
    .lte("next_attempt_at", now.toISOString())
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);

  let processed = 0;
  let failed = 0;
  let ignored = 0;

  for (const row of candidates ?? []) {
    const lease = await input.admin
      .from("spoton_webhook_inbox")
      .update({
        processing_status: "processing",
        lease_owner: leaseOwner,
        lease_expires_at: new Date(now.getTime() + LEASE_MS).toISOString(),
        attempt_count: (row.attempt_count ?? 0) + 1,
      })
      .eq("id", row.id)
      .in("processing_status", ["pending", "failed"])
      .select("id")
      .maybeSingle();
    if (lease.error) throw new Error(lease.error.message);
    if (!lease.data) continue;

    try {
      const outcome = await applyWebhookBusinessEffects(input.admin, input.venueId, row);
      if (outcome === "ignored") {
        ignored += 1;
        await input.admin
          .from("spoton_webhook_inbox")
          .update({
            processing_status: "ignored",
            processed_at: new Date().toISOString(),
            lease_owner: null,
            lease_expires_at: null,
            processing_error: null,
          })
          .eq("id", row.id);
      } else {
        processed += 1;
        await input.admin
          .from("spoton_webhook_inbox")
          .update({
            processing_status: "processed",
            processed_at: new Date().toISOString(),
            lease_owner: null,
            lease_expires_at: null,
            processing_error: null,
          })
          .eq("id", row.id);
        await input.admin
          .from("spoton_settings")
          .update({
            last_processed_event_id: row.event_id,
            last_processed_event_at: new Date().toISOString(),
          })
          .eq("venue_id", input.venueId);
      }
    } catch (err) {
      failed += 1;
      const attempt = (row.attempt_count ?? 0) + 1;
      const message = err instanceof Error ? err.message.slice(0, 500) : "Processing failed";
      await input.admin
        .from("spoton_webhook_inbox")
        .update({
          processing_status: attempt >= MAX_ATTEMPTS ? "failed" : "failed",
          processing_error: message,
          next_attempt_at: new Date(Date.now() + backoffMs(attempt)).toISOString(),
          lease_owner: null,
          lease_expires_at: null,
        })
        .eq("id", row.id);
    }
  }

  // Recover expired leases
  await input.admin
    .from("spoton_webhook_inbox")
    .update({
      processing_status: "pending",
      lease_owner: null,
      lease_expires_at: null,
      next_attempt_at: new Date().toISOString(),
    })
    .eq("venue_id", input.venueId)
    .eq("processing_status", "processing")
    .lt("lease_expires_at", now.toISOString());

  return { processed, failed, ignored };
}

async function applyWebhookBusinessEffects(
  admin: SupabaseClient,
  venueId: string,
  row: {
    event_category: string;
    event_type: string | null;
    payload: Record<string, unknown>;
  },
): Promise<"applied" | "ignored"> {
  if (!isSupportedWebhookCategory(row.event_category)) return "ignored";

  const details = (row.payload.details ?? {}) as Record<string, unknown>;

  if (row.event_category === "EVENT_CATEGORY_ITEM") {
    const item = (details.item ?? {}) as Record<string, unknown>;
    const externalItemId = typeof item.id === "string" ? item.id : null;
    if (!externalItemId) return "ignored";
    const available = typeof item.available === "boolean" ? item.available : null;
    const name = typeof item.name === "string" ? item.name : "Item";
    const { data: settings } = await admin
      .from("spoton_settings")
      .select("location_id, api_product")
      .eq("venue_id", venueId)
      .maybeSingle();
    const apiProduct =
      settings?.api_product === "restaurant_export" || settings?.api_product === "central_api"
        ? settings.api_product
        : "central_api";
    const locationId = settings?.location_id ?? "unknown";

    const upsert = await admin.from("spoton_menu_items").upsert(
      {
        venue_id: venueId,
        api_product: apiProduct,
        location_id: locationId,
        external_item_id: externalItemId,
        name,
        available,
        availability_known: available !== null,
        availability_updated_at: new Date().toISOString(),
        source_updated_at: new Date().toISOString(),
        raw_allowlist: item,
      },
      { onConflict: "venue_id,api_product,external_item_id" },
    );
    if (upsert.error) throw new Error(upsert.error.message);
    return "applied";
  }

  if (row.event_category === "EVENT_CATEGORY_MENU") {
    // Menu change: mark menu capability fresh; full refresh is via menu sync job.
    await admin
      .from("spoton_settings")
      .update({ menu_status: "configured_unverified" })
      .eq("venue_id", venueId);
    await admin.from("spoton_sync_runs").insert({
      venue_id: venueId,
      kind: "menu_sync",
      api_product: "central_api",
      status: "queued",
      details: { reason: "webhook_menu_update" },
    });
    return "applied";
  }

  if (row.event_category === "EVENT_CATEGORY_ORDER") {
    // Documented Central order webhooks are cancelation / fulfillment updates —
    // not a complete sales stream. Record without treating as a full order snapshot.
    return "ignored";
  }

  return "ignored";
}

export async function replayWebhookEvent(input: {
  admin: SupabaseClient;
  venueId: string;
  inboxId: string;
  requestedBy?: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await input.admin
    .from("spoton_webhook_inbox")
    .select("id")
    .eq("id", input.inboxId)
    .eq("venue_id", input.venueId)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Webhook event not found" };

  await input.admin
    .from("spoton_webhook_inbox")
    .update({
      processing_status: "pending",
      next_attempt_at: new Date().toISOString(),
      processing_error: null,
      lease_owner: null,
      lease_expires_at: null,
    })
    .eq("id", input.inboxId);

  await input.admin.from("spoton_sync_runs").insert({
    venue_id: input.venueId,
    kind: "replay_webhook",
    api_product: "webhook",
    status: "queued",
    requested_by: input.requestedBy ?? null,
    details: { inboxId: input.inboxId },
  });

  return { ok: true };
}
