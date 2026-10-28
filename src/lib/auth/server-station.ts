import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import {
  SERVER_STATION_DEVICE_COOKIE,
  SERVER_STATION_HOME_PATH,
  SERVER_STATION_LOGIN_PATH,
  SERVER_STATION_PIN_LOCK_SECONDS,
  SERVER_STATION_PIN_MAX_ATTEMPTS,
  SERVER_STATION_SQL,
} from "@/lib/constants";
import { getCronSecret, getServiceRoleKey } from "@/lib/env";
import { createDisplayPairingCode, hashDisplaySecret, normalizeDisplayPairingCode } from "@/lib/display-devices/crypto";

export const SERVER_STATION_MENUS = ["server"] as const;

export {
  SERVER_STATION_DEVICE_COOKIE,
  SERVER_STATION_HOME_PATH,
  SERVER_STATION_LOGIN_PATH,
  SERVER_STATION_SQL,
};

export function isMissingServerStationRelation(message: string | null | undefined) {
  return (
    /server_station_|led_server_items|led_wall_overrides|server_approved|menus_enabled|submitted_youtube|upload_library/i.test(
      message ?? "",
    ) && /does not exist|schema cache|could not find/i.test(message ?? "")
  );
}

function signingSecret(): string | null {
  return getCronSecret() || getServiceRoleKey();
}

export function canSignServerStationCookies() {
  return Boolean(signingSecret());
}

export function hashServerStationToken(value: string) {
  return hashDisplaySecret(value);
}

export function createServerStationDeviceToken() {
  return `fbss_${randomBytes(32).toString("base64url")}`;
}

export function createServerStationPairingCode() {
  return createDisplayPairingCode();
}

export function normalizeServerStationPairingCode(code: string) {
  return normalizeDisplayPairingCode(code);
}

export function hashServerStationPin(pin: string, salt: string) {
  return scryptSync(pin, salt, 32).toString("base64url");
}

export function createServerStationPinSalt() {
  return randomBytes(16).toString("base64url");
}

export function verifyServerStationPin(pin: string, salt: string, storedHash: string) {
  const candidate = Buffer.from(hashServerStationPin(pin, salt));
  const stored = Buffer.from(storedHash);
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}

export function pinLockUntil(failedAttempts: number, now = Date.now()) {
  if (failedAttempts < SERVER_STATION_PIN_MAX_ATTEMPTS) return null;
  return new Date(now + SERVER_STATION_PIN_LOCK_SECONDS * 1000).toISOString();
}

export type ServerStationStaffSession = {
  venueId: string;
  /** Auth user id for staff PINs. For name-and-PIN operators this is the operator id so older cookie checks still pass. */
  userId: string;
  /** Set when this session is a kiosk operator (name + PIN, no staff account). */
  operatorId?: string | null;
  deviceId: string | null;
  displayName: string;
  exp: number;
};

function encodeSession(payload: ServerStationStaffSession) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function signBody(body: string, secret: string) {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

export function issueServerStationStaffCookie(
  payload: Omit<ServerStationStaffSession, "exp">,
  idleSeconds: number,
  now = Date.now(),
): string | null {
  const secret = signingSecret();
  if (!secret) return null;
  const full: ServerStationStaffSession = {
    ...payload,
    exp: Math.floor(now / 1000) + Math.max(30, idleSeconds),
  };
  const body = encodeSession(full);
  return `${body}.${signBody(body, secret)}`;
}

export function verifyServerStationStaffCookie(
  token: string | null | undefined,
  now = Date.now(),
): { ok: true; session: ServerStationStaffSession } | { ok: false; message: string } {
  const secret = signingSecret();
  if (!secret) return { ok: false, message: "Server Station is not configured on this server." };
  if (!token) return { ok: false, message: "Staff session expired. Enter your PIN again." };

  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, message: "Staff session is invalid." };
  const [body, signature] = parts;
  if (!body || !signature) return { ok: false, message: "Staff session is invalid." };

  const expected = signBody(body, secret);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return { ok: false, message: "Staff session is invalid." };
  }

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ServerStationStaffSession;
    if (!parsed?.venueId || !parsed?.userId || !Number.isFinite(parsed.exp)) {
      return { ok: false, message: "Staff session is invalid." };
    }
    if (parsed.operatorId && parsed.operatorId !== parsed.userId) {
      return { ok: false, message: "Staff session is invalid." };
    }
    if (parsed.exp * 1000 <= now) {
      return { ok: false, message: "Staff session expired. Enter your PIN again." };
    }
    return { ok: true, session: parsed };
  } catch {
    return { ok: false, message: "Staff session is invalid." };
  }
}

export function refreshServerStationStaffCookie(
  session: ServerStationStaffSession,
  idleSeconds: number,
  now = Date.now(),
) {
  return issueServerStationStaffCookie(
    {
      venueId: session.venueId,
      userId: session.userId,
      operatorId: session.operatorId ?? null,
      deviceId: session.deviceId,
      displayName: session.displayName,
    },
    idleSeconds,
    now,
  );
}
