import { DateTime } from "luxon";
import { PHOTO_BOOTH_TIME_ZONE } from "@/lib/photo-booth/constants";

export type CameraCandidate = { deviceId: string; label: string };

export type CoverRect = { sx: number; sy: number; sw: number; sh: number };

/** Center-crop `source` so it covers `dest` without stretching. */
export function coverSourceRect(
  sourceWidth: number,
  sourceHeight: number,
  destWidth: number,
  destHeight: number,
): CoverRect {
  const scale = Math.max(destWidth / sourceWidth, destHeight / sourceHeight);
  const sw = destWidth / scale;
  const sh = destHeight / scale;
  return {
    sx: (sourceWidth - sw) / 2,
    sy: (sourceHeight - sh) / 2,
    sw,
    sh,
  };
}

/**
 * Prefer a Mevo / USB webcam over a built-in kiosk camera.
 * A saved device id wins when that camera is still attached.
 */
export function scoreCameraLabel(label: string): number {
  const value = label.toLowerCase();
  if (value.includes("mevo")) return 100;
  if (/virtual|obs virtual|snap camera/.test(value)) return -50;
  if (/uvc|usb/.test(value)) return 80;
  if (/webcam|web camera/.test(value)) return 70;
  if (/front|facetime|integrated|built-in|user facing/.test(value)) return 10;
  if (/back|rear|environment/.test(value)) return 30;
  if (value.trim()) return 40;
  return 0;
}

export function pickCamera(devices: CameraCandidate[], savedId: string | null): string | null {
  const usable = devices.filter((device) => device.deviceId);
  if (savedId && usable.some((device) => device.deviceId === savedId)) return savedId;
  if (usable.length === 0) return null;
  return [...usable].sort((a, b) => {
    const score = scoreCameraLabel(b.label) - scoreCameraLabel(a.label);
    if (score !== 0) return score;
    return a.label.localeCompare(b.label);
  })[0]?.deviceId ?? null;
}

export function sanitizePhotoBoothLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  return cleaned || null;
}

export function isJpeg(bytes: Uint8Array): boolean {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return false;
  const start = Math.max(2, bytes.length - 16);
  for (let i = bytes.length - 2; i >= start; i -= 1) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd9) return true;
  }
  return false;
}

export function formatPhotoBoothWhen(now: Date, timeZone = PHOTO_BOOTH_TIME_ZONE): string {
  return DateTime.fromJSDate(now).setZone(timeZone).toFormat("ccc LLL d · h:mm a");
}

export function formatPhotoBoothExpiry(iso: string, timeZone = PHOTO_BOOTH_TIME_ZONE): string {
  const dt = DateTime.fromISO(iso, { setZone: true }).setZone(timeZone);
  if (!dt.isValid) return "48 hours";
  return dt.toFormat("ccc, LLL d 'at' h:mm a");
}
