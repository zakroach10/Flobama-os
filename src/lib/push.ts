import webpush from "web-push";
import {
  getSiteUrl,
  getVapidPrivateKey,
  getVapidPublicKey,
  isPushConfigured,
} from "@/lib/env";

export type SerializedPushSubscription = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  expirationTime?: number | null;
};

export { getVapidPrivateKey, getVapidPublicKey, isPushConfigured };

function vapidSubject(): string {
  return process.env.VAPID_SUBJECT?.trim() || "mailto:ops@flobama.com";
}

let configured = false;

export function ensureWebPushConfigured(): { ok: true } | { ok: false; message: string } {
  const publicKey = getVapidPublicKey();
  const privateKey = getVapidPrivateKey();
  if (!publicKey || !privateKey) {
    return {
      ok: false,
      message: "Push is not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.",
    };
  }
  if (!configured) {
    webpush.setVapidDetails(vapidSubject(), publicKey, privateKey);
    configured = true;
  }
  return { ok: true };
}

export function isSerializedPushSubscription(value: unknown): value is SerializedPushSubscription {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (typeof record.endpoint !== "string" || !record.endpoint.trim()) return false;
  const keys = record.keys;
  if (!keys || typeof keys !== "object") return false;
  const keyRecord = keys as Record<string, unknown>;
  return typeof keyRecord.p256dh === "string" && typeof keyRecord.auth === "string";
}

export async function sendWebPush(
  subscription: SerializedPushSubscription,
  payload: { title: string; body: string; url?: string; icon?: string },
): Promise<{ ok: true } | { ok: false; statusCode?: number; message: string }> {
  const gate = ensureWebPushConfigured();
  if (!gate.ok) return gate;

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      },
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: payload.icon ?? "/icon-192.png",
        badge: "/icon-192.png",
        url: payload.url ?? "/dashboard",
      }),
    );
    return { ok: true };
  } catch (error) {
    const statusCode =
      error && typeof error === "object" && "statusCode" in error
        ? Number((error as { statusCode?: number }).statusCode)
        : undefined;
    const message = error instanceof Error ? error.message : "Failed to send push notification";
    return { ok: false, statusCode, message };
  }
}

export function pushClickUrl(path = "/dashboard"): string {
  try {
    return new URL(path, getSiteUrl()).toString();
  } catch {
    return path;
  }
}
