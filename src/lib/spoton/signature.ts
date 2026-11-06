import { createHmac, timingSafeEqual } from "node:crypto";
import { SPOTON_SIGNATURE_VERSION } from "@/lib/spoton/types";

/**
 * Central API v1 webhook signature verification.
 * Docs: https://developers.spoton.com/central-api/reference/webhookevent_delivery-1
 *
 * 1. Base64-decode signature_key (standard alphabet; padding optional)
 * 2. HMAC-SHA256 over exact raw body bytes
 * 3. Lowercase hex digest (64 chars)
 * 4. Constant-time compare to X-Spoton-Webhook-Signature
 */
export function decodeSpotOnSignatureKey(signatureKeyBase64: string): Buffer {
  const trimmed = signatureKeyBase64.trim();
  if (!trimmed) throw new Error("Empty signature key");
  const padded = trimmed + "=".repeat((4 - (trimmed.length % 4)) % 4);
  const key = Buffer.from(padded, "base64");
  if (key.length === 0) throw new Error("Decoded signature key is empty");
  return key;
}

export function computeSpotOnWebhookSignature(rawBody: Buffer, signatureKeyBase64: string): string {
  const key = decodeSpotOnSignatureKey(signatureKeyBase64);
  return createHmac("sha256", key).update(rawBody).digest("hex");
}

export function verifySpotOnWebhookSignature(input: {
  rawBody: Buffer;
  signatureHeader: string | null;
  signatureVersionHeader: string | null;
  signatureKeyBase64: string;
}): { ok: true } | { ok: false; reason: string } {
  const version = (input.signatureVersionHeader ?? "").trim().toLowerCase();
  if (!version) {
    return { ok: false, reason: "Missing X-Spoton-Webhook-Signature-Version" };
  }
  if (version !== SPOTON_SIGNATURE_VERSION) {
    return { ok: false, reason: `Unsupported signature version: ${version}` };
  }

  const provided = (input.signatureHeader ?? "").trim().toLowerCase();
  if (!provided) {
    return { ok: false, reason: "Missing X-Spoton-Webhook-Signature" };
  }
  if (!/^[0-9a-f]{64}$/.test(provided)) {
    return { ok: false, reason: "Malformed X-Spoton-Webhook-Signature" };
  }

  let expected: string;
  try {
    expected = computeSpotOnWebhookSignature(input.rawBody, input.signatureKeyBase64);
  } catch {
    return { ok: false, reason: "Invalid signature key configuration" };
  }

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "Invalid webhook signature" };
  }
  return { ok: true };
}
