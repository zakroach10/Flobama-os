import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getCronSecret, getServiceRoleKey } from "@/lib/env";

export const WALL_LED_UPLOAD_TTL_SECONDS = 15 * 60;

export type WallLedUploadPayload = {
  venueId: string;
  exp: number;
  nonce: string;
};

function signingSecret(): string | null {
  return getCronSecret() || getServiceRoleKey();
}

export function canIssueWallLedUploadTokens() {
  return Boolean(signingSecret());
}

function encodePayload(payload: WallLedUploadPayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function signBody(body: string, secret: string) {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

export function issueWallLedUploadToken(venueId: string, now = Date.now()): string | null {
  const secret = signingSecret();
  if (!secret) return null;
  const payload: WallLedUploadPayload = {
    venueId,
    exp: Math.floor(now / 1000) + WALL_LED_UPLOAD_TTL_SECONDS,
    nonce: randomBytes(8).toString("hex"),
  };
  const body = encodePayload(payload);
  return `${body}.${signBody(body, secret)}`;
}

export function verifyWallLedUploadToken(
  token: string | null | undefined,
  now = Date.now(),
): { ok: true; payload: WallLedUploadPayload } | { ok: false; message: string } {
  const secret = signingSecret();
  if (!secret) return { ok: false, message: "Phone upload is not configured on this server." };
  if (!token || typeof token !== "string") return { ok: false, message: "Upload link is missing." };

  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, message: "Upload link is invalid." };
  const [body, signature] = parts;
  if (!body || !signature) return { ok: false, message: "Upload link is invalid." };

  const expected = signBody(body, secret);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return { ok: false, message: "Upload link is invalid." };
  }

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as WallLedUploadPayload;
    if (!parsed?.venueId || typeof parsed.venueId !== "string") {
      return { ok: false, message: "Upload link is invalid." };
    }
    if (!Number.isFinite(parsed.exp) || parsed.exp * 1000 <= now) {
      return { ok: false, message: "This upload link expired. Scan a new QR from the wall dashboard." };
    }
    return { ok: true, payload: parsed };
  } catch {
    return { ok: false, message: "Upload link is invalid." };
  }
}
