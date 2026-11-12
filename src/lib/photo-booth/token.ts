import { createHash, randomBytes } from "node:crypto";

const TOKEN_PATTERN = /^pb_[A-Za-z0-9_-]{43}$/;

export function createPhotoBoothToken() {
  return `pb_${randomBytes(32).toString("base64url")}`;
}

export function isPhotoBoothTokenShape(token: string) {
  return TOKEN_PATTERN.test(token);
}

/** SHA-256 hex. The plaintext token is only in the guest's link, never in the database. */
export function hashPhotoBoothToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
