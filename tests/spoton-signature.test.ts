import { describe, expect, it } from "vitest";
import {
  computeSpotOnWebhookSignature,
  decodeSpotOnSignatureKey,
  verifySpotOnWebhookSignature,
} from "@/lib/spoton/signature";
import { authenticateSpotOnWebhook } from "@/lib/spoton/webhook";
import { SPOTON_WEBHOOK_MAX_BODY_BYTES } from "@/lib/spoton/types";

const KEY_BYTES = Buffer.from("flobama-spoton-test-key-bytes!!");
const KEY_B64 = KEY_BYTES.toString("base64").replace(/=+$/, "");

function signedBody(body: string) {
  const raw = Buffer.from(body, "utf8");
  const signature = computeSpotOnWebhookSignature(raw, KEY_B64);
  return { raw, signature };
}

describe("SpotOn webhook signature (Central API v1)", () => {
  it("decodes Base64 signature keys without padding", () => {
    expect(decodeSpotOnSignatureKey(KEY_B64).equals(KEY_BYTES)).toBe(true);
  });

  it("accepts a valid raw-body HMAC hex signature", () => {
    const body = JSON.stringify({
      id: "evt-1",
      timestamp: "2026-11-05T18:00:00Z",
      category: "EVENT_CATEGORY_ITEM",
      location_id: "BL-TEST",
      details: { item: { id: "item-1", type: "EVENT_TYPE_AVAILABILITY_UPDATED", available: false } },
    });
    const { raw, signature } = signedBody(body);
    const result = verifySpotOnWebhookSignature({
      rawBody: raw,
      signatureHeader: signature,
      signatureVersionHeader: "v1",
      signatureKeyBase64: KEY_B64,
    });
    expect(result).toEqual({ ok: true });
  });

  it("rejects tampered bodies and wrong versions", () => {
    const { raw, signature } = signedBody('{"id":"a"}');
    expect(
      verifySpotOnWebhookSignature({
        rawBody: Buffer.from('{"id":"b"}'),
        signatureHeader: signature,
        signatureVersionHeader: "v1",
        signatureKeyBase64: KEY_B64,
      }).ok,
    ).toBe(false);
    expect(
      verifySpotOnWebhookSignature({
        rawBody: raw,
        signatureHeader: signature,
        signatureVersionHeader: "v2",
        signatureKeyBase64: KEY_B64,
      }).ok,
    ).toBe(false);
    expect(
      verifySpotOnWebhookSignature({
        rawBody: raw,
        signatureHeader: null,
        signatureVersionHeader: "v1",
        signatureKeyBase64: KEY_B64,
      }).ok,
    ).toBe(false);
  });

  it("authenticates location and rejects oversized/malformed payloads", () => {
    const good = {
      id: "evt-2",
      timestamp: "2026-11-05T18:00:00Z",
      category: "EVENT_CATEGORY_MENU",
      location_id: "BL-TEST",
      details: { menu: { id: "m1", type: "EVENT_TYPE_UPDATED" } },
    };
    const body = JSON.stringify(good);
    const { raw, signature } = signedBody(body);
    const ok = authenticateSpotOnWebhook({
      rawBody: raw,
      signatureHeader: signature,
      signatureVersionHeader: "v1",
      signatureKeyBase64: KEY_B64,
      configuredLocationId: "BL-TEST",
    });
    expect(ok.ok).toBe(true);

    const wrongLocation = signedBody(JSON.stringify({ ...good, location_id: "BL-OTHER" }));
    const unauthorized = authenticateSpotOnWebhook({
      rawBody: wrongLocation.raw,
      signatureHeader: wrongLocation.signature,
      signatureVersionHeader: "v1",
      signatureKeyBase64: KEY_B64,
      configuredLocationId: "BL-TEST",
    });
    expect(unauthorized.ok).toBe(false);
    if (!unauthorized.ok) expect(unauthorized.status).toBe(401);

    const huge = Buffer.alloc(SPOTON_WEBHOOK_MAX_BODY_BYTES + 1, 0x61);
    const oversized = authenticateSpotOnWebhook({
      rawBody: huge,
      signatureHeader: "a".repeat(64),
      signatureVersionHeader: "v1",
      signatureKeyBase64: KEY_B64,
      configuredLocationId: "BL-TEST",
    });
    expect(oversized.ok).toBe(false);
    if (!oversized.ok) expect(oversized.status).toBe(413);

    const malformed = signedBody("{not-json");
    const badJson = authenticateSpotOnWebhook({
      rawBody: malformed.raw,
      signatureHeader: malformed.signature,
      signatureVersionHeader: "v1",
      signatureKeyBase64: KEY_B64,
      configuredLocationId: "BL-TEST",
    });
    expect(badJson.ok).toBe(false);
    if (!badJson.ok) expect(badJson.status).toBe(400);
  });

  it("does not accept unsigned production requests when key is missing", () => {
    const body = Buffer.from("{}");
    const result = authenticateSpotOnWebhook({
      rawBody: body,
      signatureHeader: null,
      signatureVersionHeader: null,
      signatureKeyBase64: null,
      configuredLocationId: "BL-TEST",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });
});
