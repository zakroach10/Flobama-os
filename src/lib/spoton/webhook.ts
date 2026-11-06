import { z } from "zod";
import { sanitizeWebhookPayload } from "@/lib/spoton/sanitize";
import { verifySpotOnWebhookSignature } from "@/lib/spoton/signature";
import {
  SPOTON_SUPPORTED_WEBHOOK_CATEGORIES,
  SPOTON_WEBHOOK_CATEGORIES,
  SPOTON_WEBHOOK_MAX_BODY_BYTES,
  type SpotOnWebhookCategory,
} from "@/lib/spoton/types";

const webhookEventSchema = z.object({
  id: z.string().min(1).max(200),
  timestamp: z.string().min(1).max(64),
  category: z.enum(SPOTON_WEBHOOK_CATEGORIES),
  location_id: z.string().min(1).max(120),
  organization_id: z.string().min(1).max(120).optional(),
  details: z.record(z.string(), z.unknown()),
});

export type ParsedWebhookEvent = z.infer<typeof webhookEventSchema> & {
  eventType: string | null;
  sanitizedPayload: Record<string, unknown>;
};

export type WebhookAuthResult =
  | { ok: true; event: ParsedWebhookEvent; rawBytes: number }
  | { ok: false; status: 400 | 401 | 413 | 500; retryable: boolean; message: string };

function extractEventType(details: Record<string, unknown>): string | null {
  for (const value of Object.values(details)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const type = (value as Record<string, unknown>).type;
      if (typeof type === "string" && type.length > 0) return type.slice(0, 80);
    }
  }
  return null;
}

export function authenticateSpotOnWebhook(input: {
  rawBody: Buffer;
  signatureHeader: string | null;
  signatureVersionHeader: string | null;
  signatureKeyBase64: string | null;
  configuredLocationId: string | null;
}): WebhookAuthResult {
  if (input.rawBody.byteLength > SPOTON_WEBHOOK_MAX_BODY_BYTES) {
    return {
      ok: false,
      status: 413,
      retryable: false,
      message: `Payload exceeds ${SPOTON_WEBHOOK_MAX_BODY_BYTES} bytes`,
    };
  }
  if (!input.signatureKeyBase64) {
    return {
      ok: false,
      status: 401,
      retryable: false,
      message: "Webhook signature key is not configured",
    };
  }
  if (!input.configuredLocationId) {
    return {
      ok: false,
      status: 401,
      retryable: false,
      message: "SpotOn location id is not configured",
    };
  }

  const signature = verifySpotOnWebhookSignature({
    rawBody: input.rawBody,
    signatureHeader: input.signatureHeader,
    signatureVersionHeader: input.signatureVersionHeader,
    signatureKeyBase64: input.signatureKeyBase64,
  });
  if (!signature.ok) {
    return { ok: false, status: 401, retryable: false, message: signature.reason };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(input.rawBody.toString("utf8"));
  } catch {
    return { ok: false, status: 400, retryable: false, message: "Malformed JSON body" };
  }

  const parsed = webhookEventSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return { ok: false, status: 400, retryable: false, message: "Invalid webhook schema" };
  }

  if (parsed.data.location_id !== input.configuredLocationId) {
    return {
      ok: false,
      status: 401,
      retryable: false,
      message: "Unauthorized location_id",
    };
  }

  const sanitizedPayload = sanitizeWebhookPayload(parsed.data);
  return {
    ok: true,
    rawBytes: input.rawBody.byteLength,
    event: {
      ...parsed.data,
      eventType: extractEventType(parsed.data.details),
      sanitizedPayload,
    },
  };
}

export function isSupportedWebhookCategory(category: string): boolean {
  return (SPOTON_SUPPORTED_WEBHOOK_CATEGORIES as readonly string[]).includes(category);
}

export function shouldIgnoreWebhookCategory(category: SpotOnWebhookCategory): boolean {
  return !isSupportedWebhookCategory(category);
}
