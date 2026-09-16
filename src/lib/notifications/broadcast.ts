import { createServiceRoleClient } from "@/lib/supabase/admin";
import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import {
  isPushConfigured,
  pushClickUrl,
  sendWebPush,
  type SerializedPushSubscription,
} from "@/lib/push";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  icon?: string;
};

export type BroadcastResult = {
  ok: boolean;
  message: string;
  sent: number;
  failed: number;
  skipped: boolean;
};

export async function broadcastPushToVenue(
  payload: PushPayload,
  venueId: string = FLO_BAMA_VENUE_ID,
): Promise<BroadcastResult> {
  if (!isPushConfigured()) {
    return { ok: false, message: "Push is not configured.", sent: 0, failed: 0, skipped: true };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return {
      ok: false,
      message: "Service role is not configured; cannot load push subscriptions.",
      sent: 0,
      failed: 0,
      skipped: true,
    };
  }

  const { data, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("venue_id", venueId);

  if (error) {
    return { ok: false, message: error.message, sent: 0, failed: 0, skipped: false };
  }
  if (!data?.length) {
    return { ok: true, message: "No push subscribers.", sent: 0, failed: 0, skipped: true };
  }

  let sent = 0;
  let failed = 0;
  const staleIds: string[] = [];
  const url = payload.url ? pushClickUrl(payload.url) : pushClickUrl("/dashboard");

  for (const row of data) {
    const subscription: SerializedPushSubscription = {
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth },
    };
    const result = await sendWebPush(subscription, {
      title: payload.title,
      body: payload.body,
      url,
      icon: payload.icon,
    });
    if (result.ok) {
      sent += 1;
    } else {
      failed += 1;
      if (result.statusCode === 404 || result.statusCode === 410) {
        staleIds.push(row.id);
      }
    }
  }

  if (staleIds.length) {
    await admin.from("push_subscriptions").delete().in("id", staleIds);
  }

  return {
    ok: sent > 0 || failed === 0,
    message: `Sent ${sent} notification${sent === 1 ? "" : "s"}${failed ? `, ${failed} failed` : ""}.`,
    sent,
    failed,
    skipped: false,
  };
}
