"use server";

import { headers } from "next/headers";
import { getStaffContext } from "@/lib/auth/staff";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getVapidPublicKey,
  isPushConfigured,
  isSerializedPushSubscription,
  pushClickUrl,
  sendWebPush,
  type SerializedPushSubscription,
} from "@/lib/push";

export type PushActionResult = {
  ok: boolean;
  message: string;
};

async function staffForPush() {
  const context = await getStaffContext();
  if (context.status === "unconfigured") {
    return { ok: false as const, message: "Supabase is not configured." };
  }
  if (context.status === "unauthenticated") {
    return { ok: false as const, message: "Sign in required." };
  }
  if (context.status === "denied") {
    return { ok: false as const, message: "You do not have staff access." };
  }
  if (context.status === "error") {
    return { ok: false as const, message: context.message };
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { ok: false as const, message: "Supabase is not configured." };
  }
  return { ok: true as const, context, supabase };
}

export async function getPushPublicKeyAction(): Promise<{ ok: true; publicKey: string | null; configured: boolean } | PushActionResult> {
  return {
    ok: true,
    publicKey: getVapidPublicKey(),
    configured: isPushConfigured(),
  };
}

export async function subscribePushAction(subscription: unknown): Promise<PushActionResult> {
  const gate = await staffForPush();
  if (!gate.ok) return { ok: false, message: gate.message };
  if (!isPushConfigured()) {
    return { ok: false, message: "Push is not configured on this server yet." };
  }
  if (!isSerializedPushSubscription(subscription)) {
    return { ok: false, message: "Invalid push subscription." };
  }

  const headerStore = await headers();
  const userAgent = headerStore.get("user-agent")?.slice(0, 400) ?? null;

  const { error } = await gate.supabase.from("push_subscriptions").upsert(
    {
      venue_id: gate.context.venue.id,
      user_id: gate.context.userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: userAgent,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,endpoint" },
  );

  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true, message: "Push notifications enabled." };
}

export async function unsubscribePushAction(endpoint?: string | null): Promise<PushActionResult> {
  const gate = await staffForPush();
  if (!gate.ok) return { ok: false, message: gate.message };

  let query = gate.supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", gate.context.userId)
    .eq("venue_id", gate.context.venue.id);

  if (endpoint?.trim()) {
    query = query.eq("endpoint", endpoint.trim());
  }

  const { error } = await query;
  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true, message: "Push notifications disabled." };
}

export async function sendTestPushAction(message?: string): Promise<PushActionResult> {
  const gate = await staffForPush();
  if (!gate.ok) return { ok: false, message: gate.message };
  if (!isPushConfigured()) {
    return { ok: false, message: "Push is not configured on this server yet." };
  }

  const { data, error } = await gate.supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", gate.context.userId)
    .eq("venue_id", gate.context.venue.id);

  if (error) {
    return { ok: false, message: error.message };
  }
  if (!data?.length) {
    return { ok: false, message: "No push subscription found for this device. Enable notifications first." };
  }

  const body = (message ?? "").trim() || "Test notification from FloBama OS.";
  let sent = 0;
  const staleIds: string[] = [];

  for (const row of data) {
    const subscription: SerializedPushSubscription = {
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth },
    };
    const result = await sendWebPush(subscription, {
      title: "FloBama OS",
      body,
      url: pushClickUrl("/dashboard"),
    });
    if (result.ok) {
      sent += 1;
    } else if (result.statusCode === 404 || result.statusCode === 410) {
      staleIds.push(row.id);
    }
  }

  if (staleIds.length) {
    await gate.supabase.from("push_subscriptions").delete().in("id", staleIds);
  }

  if (sent === 0) {
    return { ok: false, message: "Could not deliver a test notification. Try re-enabling push on this device." };
  }
  return { ok: true, message: `Sent test notification${sent > 1 ? `s (${sent})` : ""}.` };
}
