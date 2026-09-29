import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export function hashCameraSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function cameraSecretsMatch(storedHash: string, value: string) {
  const candidate = hashCameraSecret(value);
  const stored = Buffer.from(storedHash);
  const next = Buffer.from(candidate);
  if (stored.length !== next.length) return false;
  return timingSafeEqual(stored, next);
}

export function createCameraDeviceToken() {
  return `fbcam_${randomBytes(32).toString("base64url")}`;
}

/** Short human-readable pairing code (8 chars, unambiguous alphabet). */
export function createCameraPairingCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i += 1) {
    out += alphabet[randomInt(alphabet.length)];
  }
  return out;
}

export function normalizePairingCode(code: string) {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
