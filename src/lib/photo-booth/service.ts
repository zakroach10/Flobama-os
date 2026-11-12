import { PHOTO_BOOTH_IP_LIMIT, PHOTO_BOOTH_IP_WINDOW_MS, PHOTO_BOOTH_MAX_BYTES, PHOTO_BOOTH_VENUE_LIMIT, PHOTO_BOOTH_VENUE_WINDOW_MS, photoBoothExpiresAt } from "@/lib/photo-booth/constants";
import { isJpeg, sanitizePhotoBoothLabel } from "@/lib/photo-booth/frame";
import type { PhotoBoothCaptureRow, PhotoBoothRepository } from "@/lib/photo-booth/repository";
import { createPhotoBoothToken, hashPhotoBoothToken, isPhotoBoothTokenShape } from "@/lib/photo-booth/token";

export type PhotoBoothUploadResult =
  | { ok: true; token: string; expiresAt: string }
  | { ok: false; status: 400 | 413 | 429 | 500; message: string };

export async function acceptPhotoBoothUpload(
  repo: PhotoBoothRepository,
  input: {
    bytes: Uint8Array;
    eventLabel: string | null;
    clientKey: string;
    now: Date;
    venueId: string;
    id?: string;
    token?: string;
  },
): Promise<PhotoBoothUploadResult> {
  if (input.bytes.byteLength === 0 || input.bytes.byteLength > PHOTO_BOOTH_MAX_BYTES) {
    return { ok: false, status: 413, message: "That photo is too large. Try again." };
  }
  if (!isJpeg(input.bytes)) {
    return { ok: false, status: 400, message: "The booth can only save a JPEG photo." };
  }

  const nowIso = input.now.toISOString();
  const venueKey = `venue:${input.venueId}`;
  const [ipHits, venueHits] = await Promise.all([
    repo.countHits(input.clientKey, new Date(input.now.getTime() - PHOTO_BOOTH_IP_WINDOW_MS).toISOString()),
    repo.countHits(venueKey, new Date(input.now.getTime() - PHOTO_BOOTH_VENUE_WINDOW_MS).toISOString()),
  ]);
  if (ipHits >= PHOTO_BOOTH_IP_LIMIT || venueHits >= PHOTO_BOOTH_VENUE_LIMIT) {
    return { ok: false, status: 429, message: "The booth needs a minute. Try again shortly." };
  }

  const id = input.id ?? crypto.randomUUID();
  const token = input.token ?? createPhotoBoothToken();
  if (!isPhotoBoothTokenShape(token)) {
    return { ok: false, status: 500, message: "Could not start a share link." };
  }

  const storagePath = `${input.venueId}/${id}.jpg`;
  const expiresAt = photoBoothExpiresAt(input.now).toISOString();
  const uploaded = await repo.uploadJpeg(storagePath, input.bytes);
  if (uploaded.error) {
    return { ok: false, status: 500, message: "Could not store that photo." };
  }

  const inserted = await repo.insertCapture({
    id,
    venueId: input.venueId,
    storagePath,
    tokenHash: hashPhotoBoothToken(token),
    byteSize: input.bytes.byteLength,
    eventLabel: sanitizePhotoBoothLabel(input.eventLabel),
    createdAt: nowIso,
    expiresAt,
  });
  if (inserted.error) {
    await repo.deleteObject(storagePath);
    return { ok: false, status: 500, message: "Could not store that photo." };
  }

  try {
    await repo.insertHit(input.clientKey, nowIso);
    await repo.insertHit(venueKey, nowIso);
  } catch {
    // The photo is already stored. A missed rate hit must not hide the share link.
  }
  return { ok: true, token, expiresAt };
}

export type PhotoBoothShareResult =
  | { ok: true; row: PhotoBoothCaptureRow }
  | { ok: false; status: 404 | 410; message: string };

export async function resolvePhotoBoothShare(
  repo: PhotoBoothRepository,
  token: string,
  now: Date,
): Promise<PhotoBoothShareResult> {
  if (!isPhotoBoothTokenShape(token)) {
    return { ok: false, status: 404, message: "This photo isn't available." };
  }
  const row = await repo.findByTokenHash(hashPhotoBoothToken(token));
  if (!row || row.purgedAt) {
    return { ok: false, status: 404, message: "This photo isn't available." };
  }
  if (Date.parse(row.expiresAt) <= now.getTime()) {
    await purgePhotoBoothCapture(repo, row, now).catch(() => undefined);
    return { ok: false, status: 410, message: "This photo has expired." };
  }
  return { ok: true, row };
}

export async function purgeExpiredPhotoBoothCaptures(
  repo: PhotoBoothRepository,
  now: Date,
  limit: number,
): Promise<{ purged: number; failed: number }> {
  const rows = await repo.listDueForPurge(now.toISOString(), limit);
  let purged = 0;
  let failed = 0;
  for (const row of rows) {
    const ok = await purgePhotoBoothCapture(repo, row, now);
    if (ok) purged += 1;
    else failed += 1;
  }
  try {
    await repo.deleteHitsBefore(new Date(now.getTime() - PHOTO_BOOTH_VENUE_WINDOW_MS).toISOString());
  } catch {
    // The next cron run retries rate-hit cleanup.
  }
  return { purged, failed };
}

async function purgePhotoBoothCapture(repo: PhotoBoothRepository, row: PhotoBoothCaptureRow, now: Date) {
  const removed = await repo.deleteObject(row.storagePath);
  if (removed.error && !/not found|does not exist/i.test(removed.error)) return false;
  try {
    await repo.markPurged(row.id, now.toISOString());
    return true;
  } catch {
    return false;
  }
}
