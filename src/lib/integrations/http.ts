import { createHash, randomBytes } from "node:crypto";

export const INTEGRATION_BODY_LIMIT_BYTES = 65_536;

export const INTEGRATION_RATE_LIMITS = {
  credentialLimit: 120,
  credentialWindowSeconds: 60,
  ipLimit: 60,
  ipWindowSeconds: 60,
} as const;

export type IntegrationErrorCode =
  | "invalid_input"
  | "invalid_json"
  | "unsupported_media_type"
  | "payload_too_large"
  | "missing_idempotency_key"
  | "precondition_required"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "idempotency_conflict"
  | "idempotency_in_progress"
  | "edit_conflict"
  | "rate_limited"
  | "not_configured"
  | "server_error";

const STATUS_BY_CODE: Record<IntegrationErrorCode, number> = {
  invalid_input: 400,
  invalid_json: 400,
  unsupported_media_type: 415,
  payload_too_large: 413,
  missing_idempotency_key: 400,
  precondition_required: 428,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  idempotency_conflict: 409,
  idempotency_in_progress: 409,
  edit_conflict: 409,
  rate_limited: 429,
  not_configured: 503,
  server_error: 500,
};

export function statusForIntegrationCode(code: IntegrationErrorCode) {
  return STATUS_BY_CODE[code];
}

export function integrationJson(
  body: unknown,
  status: number,
  requestId: string,
  extra?: Record<string, string>,
) {
  const headers = new Headers(extra);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("x-request-id", requestId);
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

export function integrationError(
  requestId: string,
  code: IntegrationErrorCode,
  message: string,
  extras?: {
    fieldErrors?: Record<string, string[]>;
    currentUpdatedAt?: string;
    headers?: Record<string, string>;
  },
) {
  return integrationJson(
    {
      error: {
        code,
        message,
        requestId,
        ...(extras?.fieldErrors ? { fieldErrors: extras.fieldErrors } : {}),
        ...(extras?.currentUpdatedAt ? { currentUpdatedAt: extras.currentUpdatedAt } : {}),
      },
    },
    statusForIntegrationCode(code),
    requestId,
    extras?.headers,
  );
}

export function redactSecrets(value: string) {
  return value
    .replace(/fbint_[A-Za-z0-9_-]+/g, "[redacted-token]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-jwt]")
    .replace(/Bearer\s+(?!\[redacted)\S+/gi, "Bearer [redacted]")
    .slice(0, 500);
}

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,80}$/;
const TOKEN_PATTERN = /^[A-Za-z0-9._~-]{20,200}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,200}$/;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;

export function readRequestId(request: Request) {
  const raw = request.headers.get("x-request-id")?.trim() ?? "";
  if (REQUEST_ID_PATTERN.test(raw)) return raw;
  return `req_${randomBytes(16).toString("base64url")}`;
}

export function readBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  const token = match?.[1] ?? "";
  if (!TOKEN_PATTERN.test(token)) return null;
  return token;
}

export function readReportedActor(request: Request) {
  const raw = request.headers.get("x-integration-actor");
  if (!raw) return null;
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 120);
  return cleaned || null;
}

export function readIdempotencyKey(request: Request): { ok: true; value: string } | { ok: false } {
  const raw = request.headers.get("idempotency-key")?.trim() ?? "";
  if (!IDEMPOTENCY_KEY_PATTERN.test(raw)) return { ok: false };
  return { ok: true, value: raw };
}

export function readIfMatch(
  request: Request,
): { ok: true; value: string } | { ok: false; missing: boolean } {
  const raw = request.headers.get("if-match");
  if (!raw || !raw.trim()) return { ok: false, missing: true };
  const value = raw.trim();
  if (value.includes(",")) return { ok: false, missing: false };
  const unquoted = value.replace(/^W\//i, "").replace(/^"(.*)"$/, "$1").trim();
  if (!TIMESTAMP_PATTERN.test(unquoted) || Number.isNaN(Date.parse(unquoted))) {
    return { ok: false, missing: false };
  }
  return { ok: true, value: unquoted };
}

export function clientIpKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "unknown";
  return `ip:${createHash("sha256").update(ip, "utf8").digest("hex").slice(0, 32)}`;
}

export async function readJsonBody(
  request: Request,
): Promise<
  | { ok: true; value: unknown }
  | { ok: false; code: "invalid_json" | "unsupported_media_type" | "payload_too_large" }
> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return { ok: false, code: "unsupported_media_type" };
  }
  const text = await request.text();
  if (text.length > INTEGRATION_BODY_LIMIT_BYTES) return { ok: false, code: "payload_too_large" };
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, code: "invalid_json" };
  }
}
