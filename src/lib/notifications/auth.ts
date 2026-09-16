import { timingSafeEqual } from "node:crypto";

function readSecret(name: string): string | null {
  const value = process.env[name]?.trim();
  return value || null;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function authorizeCronRequest(request: Request): { ok: true } | { ok: false; status: number; message: string } {
  const secret = readSecret("CRON_SECRET");
  if (!secret) {
    return { ok: false, status: 503, message: "CRON_SECRET is not configured." };
  }

  const auth = request.headers.get("authorization")?.trim() ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const headerSecret = request.headers.get("x-cron-secret")?.trim() ?? "";
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret")?.trim() ?? "";

  const candidate = bearer || headerSecret || querySecret;
  if (!candidate || !safeEqual(candidate, secret)) {
    return { ok: false, status: 401, message: "Unauthorized." };
  }
  return { ok: true };
}

export function authorizeWebhookRequest(request: Request): { ok: true } | { ok: false; status: number; message: string } {
  const secret = readSecret("GHL_WEBHOOK_SECRET") ?? readSecret("CRON_SECRET");
  if (!secret) {
    return { ok: false, status: 503, message: "GHL_WEBHOOK_SECRET (or CRON_SECRET) is not configured." };
  }

  const auth = request.headers.get("authorization")?.trim() ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const headerSecret = request.headers.get("x-webhook-secret")?.trim() ?? "";
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret")?.trim() ?? "";

  const candidate = bearer || headerSecret || querySecret;
  if (!candidate || !safeEqual(candidate, secret)) {
    return { ok: false, status: 401, message: "Unauthorized." };
  }
  return { ok: true };
}
