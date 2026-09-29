import { DateTime } from "luxon";
import { DEFAULT_VENUE_TIMEZONE } from "@/lib/constants";
import { CAMERA_CONNECTOR_STALE_MS } from "@/lib/cameras/types";

export function isCameraConnectorStale(lastSeenAt: string | null, now: Date = new Date()) {
  if (!lastSeenAt) return true;
  const seen = Date.parse(lastSeenAt);
  return !Number.isFinite(seen) || now.getTime() - seen > CAMERA_CONNECTOR_STALE_MS;
}

export function formatCameraHeartbeat(iso: string | null) {
  if (!iso) return "Mac connector has not checked in yet.";
  const stamp = DateTime.fromISO(iso, { zone: "utc" }).setZone(DEFAULT_VENUE_TIMEZONE);
  if (!stamp.isValid) return "Mac connector has not checked in yet.";
  return `Last heartbeat ${stamp.toFormat("MMM d, h:mm:ss a")}`;
}

export function describeCameraConnectorLink(input: {
  lastSeenAt: string | null;
  remoteControlEnabled: boolean;
  revokedAt: string | null;
  now?: Date;
}) {
  if (input.revokedAt) return { online: false, label: "Revoked", tone: "error" as const };
  if (isCameraConnectorStale(input.lastSeenAt, input.now)) {
    return { online: false, label: "Offline", tone: "muted" as const };
  }
  if (!input.remoteControlEnabled) {
    return { online: true, label: "Connected · remote control disabled on Mac", tone: "warn" as const };
  }
  return { online: true, label: "Connected", tone: "ok" as const };
}

export function isMissingCameraRelation(message: string | null | undefined) {
  return /camera_/i.test(message ?? "") && /does not exist|schema cache|could not find/i.test(message ?? "");
}
