import { z } from "zod";
import {
  CAMERA_COMMAND_KINDS,
  CAMERA_COMMAND_TTL_MS,
  type CameraCapabilities,
  type CameraCommandKind,
  PTZ_DIRECTIONS,
  ZOOM_DIRECTIONS,
} from "@/lib/cameras/types";

const speedSchema = z.number().int().min(1).max(24);

export const ptzMovePayloadSchema = z.object({
  direction: z.enum(PTZ_DIRECTIONS),
  speed: speedSchema,
});

export const ptzZoomPayloadSchema = z.object({
  direction: z.enum(ZOOM_DIRECTIONS),
  speed: speedSchema,
});

export const ptzPresetRecallPayloadSchema = z.object({
  presetId: z.string().trim().min(1).max(64),
});

export const ptzPresetSavePayloadSchema = z.object({
  presetId: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(80).optional(),
});

export const ptzFocusPayloadSchema = z.object({
  direction: z.enum(["near", "far", "auto"]),
});

export const ptzStopPayloadSchema = z.object({}).strict();

const PAYLOAD_BY_KIND = {
  ptz_move: ptzMovePayloadSchema,
  ptz_stop: ptzStopPayloadSchema,
  ptz_zoom: ptzZoomPayloadSchema,
  ptz_preset_recall: ptzPresetRecallPayloadSchema,
  ptz_preset_save: ptzPresetSavePayloadSchema,
  ptz_focus: ptzFocusPayloadSchema,
} as const;

export function isCameraCommandKind(value: string): value is CameraCommandKind {
  return (CAMERA_COMMAND_KINDS as readonly string[]).includes(value);
}

export function parseCameraCommandPayload(kind: CameraCommandKind, payload: unknown) {
  return PAYLOAD_BY_KIND[kind].safeParse(payload ?? {});
}

export function commandSupportedByCamera(
  kind: CameraCommandKind,
  caps: Pick<
    CameraCapabilities,
    "ptz" | "zoom" | "presets" | "presetSave" | "focus"
  > & { isProgramOutput?: boolean },
): { ok: true } | { ok: false; reason: string } {
  if (caps.isProgramOutput) {
    return { ok: false, reason: "Program output is preview-only and cannot be controlled." };
  }
  if (kind === "ptz_stop") return { ok: true };
  if (kind === "ptz_move" && !caps.ptz) return { ok: false, reason: "This source does not support PTZ." };
  if (kind === "ptz_zoom" && !caps.zoom) return { ok: false, reason: "This source does not support zoom." };
  if (kind === "ptz_preset_recall" && !caps.presets) {
    return { ok: false, reason: "This source does not support presets." };
  }
  if (kind === "ptz_preset_save" && !caps.presetSave) {
    return { ok: false, reason: "This source does not support saving presets." };
  }
  if (kind === "ptz_focus" && !caps.focus) {
    return { ok: false, reason: "This source does not support focus control." };
  }
  return { ok: true };
}

export function cameraCommandExpiresAt(now: Date = new Date()) {
  return new Date(now.getTime() + CAMERA_COMMAND_TTL_MS).toISOString();
}

export function isCommandExpired(expiresAt: string, now: Date = new Date()) {
  const ends = Date.parse(expiresAt);
  return !Number.isFinite(ends) || ends <= now.getTime();
}
