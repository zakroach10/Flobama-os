"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStaffContext } from "@/lib/auth/staff";
import {
  authorizeCameraConfigure,
  authorizeCameraOperate,
  authorizeCameraView,
} from "@/lib/auth/permissions";
import {
  cameraCommandExpiresAt,
  commandSupportedByCamera,
} from "@/lib/cameras/commands";
import {
  createCameraPairingCode,
  hashCameraSecret,
  normalizePairingCode,
} from "@/lib/cameras/crypto";
import { isMissingCameraRelation } from "@/lib/cameras/status";
import {
  CAMERA_COMMAND_TTL_MS,
  CAMERA_LEASE_TTL_MS,
  CAMERA_PAIRING_TTL_MS,
  CAMERA_PREVIEW_TTL_MS,
} from "@/lib/cameras/types";
import { CAMERA_CONNECTOR_SQL } from "@/lib/constants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  cameraControlCommandSchema,
  cameraLeaseSchema,
  cameraPreviewStartSchema,
  revokeCameraDeviceSchema,
} from "@/lib/validation/schemas";
import type { Json } from "@/lib/database.types";

export type CameraActionResult = {
  ok: boolean;
  message: string;
  pairingCode?: string;
  expiresAt?: string;
  commandId?: string;
  leaseExpiresAt?: string;
  previewSessionId?: string;
  previewUrl?: string;
};

function fieldMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Check the highlighted fields.";
}

function cameraSqlMessage(message: string) {
  if (isMissingCameraRelation(message)) {
    return `Apply ${CAMERA_CONNECTOR_SQL} in the Supabase SQL editor, then try again.`;
  }
  return message;
}

async function staffGate(mode: "view" | "operate" | "configure") {
  const context = await getStaffContext();
  if (context.status === "unconfigured") return { ok: false as const, message: "Supabase is not configured." };
  if (context.status === "unauthenticated") return { ok: false as const, message: "Sign in required." };
  if (context.status === "denied") return { ok: false as const, message: "You do not have staff access." };
  if (context.status === "error") return { ok: false as const, message: context.message };
  const allowed =
    mode === "configure"
      ? authorizeCameraConfigure(context.role)
      : mode === "operate"
        ? authorizeCameraOperate(context.role)
        : authorizeCameraView(context.role);
  if (!allowed.allowed) return { ok: false as const, message: allowed.reason };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { ok: false as const, message: "Supabase is not configured." };
  return { ok: true as const, context, supabase };
}

function revalidateCameras() {
  revalidatePath("/cameras");
}

async function writeAudit(
  venueId: string,
  actorUserId: string | null,
  action: string,
  detail: Record<string, unknown>,
  ids?: { deviceId?: string | null; cameraId?: string | null },
) {
  const admin = createServiceRoleClient();
  const client = admin ?? (await createServerSupabaseClient());
  if (!client) return;
  await client.from("camera_audit_log").insert({
    venue_id: venueId,
    actor_user_id: actorUserId,
    device_id: ids?.deviceId ?? null,
    camera_id: ids?.cameraId ?? null,
    action,
    detail: detail as Json,
  });
}

export async function createCameraPairingCodeAction(): Promise<CameraActionResult> {
  const gate = await staffGate("configure");
  if (!gate.ok) return { ok: false, message: gate.message };

  const code = createCameraPairingCode();
  const expiresAt = new Date(Date.now() + CAMERA_PAIRING_TTL_MS).toISOString();
  const { error } = await gate.supabase.from("camera_connector_pairing_codes").insert({
    venue_id: gate.context.venue.id,
    code_hash: hashCameraSecret(normalizePairingCode(code)),
    expires_at: expiresAt,
    created_by: gate.context.userId,
  });
  if (error) return { ok: false, message: cameraSqlMessage(error.message) };

  await writeAudit(gate.context.venue.id, gate.context.userId, "pairing_code_created", {
    expiresAt,
  });
  revalidateCameras();
  return {
    ok: true,
    pairingCode: code,
    expiresAt,
    message: "Pairing code created. Enter it on the Mac connector within 10 minutes. It will not be shown again.",
  };
}

export async function revokeCameraDeviceAction(input: unknown): Promise<CameraActionResult> {
  const gate = await staffGate("configure");
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = revokeCameraDeviceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, message: "Set SUPABASE_SERVICE_ROLE_KEY before revoking a device." };
  }

  const { data: device, error: findError } = await admin
    .from("camera_connector_devices")
    .select("id, venue_id, revoked_at")
    .eq("id", parsed.data.deviceId)
    .eq("venue_id", gate.context.venue.id)
    .maybeSingle();
  if (findError) return { ok: false, message: cameraSqlMessage(findError.message) };
  if (!device) return { ok: false, message: "Device not found." };
  if (device.revoked_at) return { ok: true, message: "Device was already revoked." };

  const now = new Date().toISOString();
  const { error } = await admin
    .from("camera_connector_devices")
    .update({ revoked_at: now, remote_control_enabled: false })
    .eq("id", device.id);
  if (error) return { ok: false, message: cameraSqlMessage(error.message) };

  await admin
    .from("camera_sources")
    .update({ online: false, last_error: "Device credential revoked." })
    .eq("device_id", device.id);

  await writeAudit(gate.context.venue.id, gate.context.userId, "device_revoked", {}, { deviceId: device.id });
  revalidateCameras();
  return { ok: true, message: "Mac connector credential revoked." };
}

async function ensureControlLease(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  input: { venueId: string; cameraId: string; userId: string },
): Promise<{ ok: true; expiresAt: string } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase is not configured." };
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CAMERA_LEASE_TTL_MS).toISOString();
  const { data: existing } = await supabase
    .from("camera_control_leases")
    .select("holder_user_id, expires_at")
    .eq("camera_id", input.cameraId)
    .maybeSingle();

  if (existing && existing.holder_user_id !== input.userId && Date.parse(existing.expires_at) > now.getTime()) {
    return { ok: false, message: "Another staff member currently controls this camera." };
  }

  const { error } = await supabase.from("camera_control_leases").upsert(
    {
      camera_id: input.cameraId,
      venue_id: input.venueId,
      holder_user_id: input.userId,
      expires_at: expiresAt,
    },
    { onConflict: "camera_id" },
  );
  if (error) return { ok: false, message: cameraSqlMessage(error.message) };
  return { ok: true, expiresAt };
}

export async function renewCameraLeaseAction(input: unknown): Promise<CameraActionResult> {
  const gate = await staffGate("operate");
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = cameraLeaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  const { data: camera, error } = await gate.supabase
    .from("camera_sources")
    .select("id, device_id, is_program_output, supports_ptz")
    .eq("id", parsed.data.cameraId)
    .eq("venue_id", gate.context.venue.id)
    .maybeSingle();
  if (error) return { ok: false, message: cameraSqlMessage(error.message) };
  if (!camera) return { ok: false, message: "Camera not found." };
  if (camera.is_program_output) {
    return { ok: false, message: "Program output is preview-only." };
  }

  const lease = await ensureControlLease(gate.supabase, {
    venueId: gate.context.venue.id,
    cameraId: camera.id,
    userId: gate.context.userId,
  });
  if (!lease.ok) return { ok: false, message: lease.message };
  return { ok: true, message: "Control lease renewed.", leaseExpiresAt: lease.expiresAt };
}

export async function releaseCameraLeaseAction(input: unknown): Promise<CameraActionResult> {
  const gate = await staffGate("operate");
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = cameraLeaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  await gate.supabase
    .from("camera_control_leases")
    .delete()
    .eq("camera_id", parsed.data.cameraId)
    .eq("venue_id", gate.context.venue.id)
    .eq("holder_user_id", gate.context.userId);

  // Best-effort stop when releasing control.
  const { data: camera } = await gate.supabase
    .from("camera_sources")
    .select("id, device_id")
    .eq("id", parsed.data.cameraId)
    .eq("venue_id", gate.context.venue.id)
    .maybeSingle();
  if (camera) {
    await gate.supabase.from("camera_commands").insert({
      venue_id: gate.context.venue.id,
      camera_id: camera.id,
      device_id: camera.device_id,
      kind: "ptz_stop",
      payload: {},
      issued_by: gate.context.userId,
      expires_at: cameraCommandExpiresAt(),
    });
  }

  revalidateCameras();
  return { ok: true, message: "Control released." };
}

export async function issueCameraCommandAction(input: unknown): Promise<CameraActionResult> {
  const gate = await staffGate("operate");
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = cameraControlCommandSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  const { data: camera, error } = await gate.supabase
    .from("camera_sources")
    .select(
      "id, device_id, is_program_output, supports_ptz, supports_zoom, supports_presets, supports_preset_save, supports_focus, online",
    )
    .eq("id", parsed.data.cameraId)
    .eq("venue_id", gate.context.venue.id)
    .maybeSingle();
  if (error) return { ok: false, message: cameraSqlMessage(error.message) };
  if (!camera) return { ok: false, message: "Camera not found." };

  const support = commandSupportedByCamera(parsed.data.kind, {
    ptz: camera.supports_ptz,
    zoom: camera.supports_zoom,
    presets: camera.supports_presets,
    presetSave: camera.supports_preset_save,
    focus: camera.supports_focus,
    isProgramOutput: camera.is_program_output,
  });
  if (!support.ok) return { ok: false, message: support.reason };

  const { data: device } = await gate.supabase
    .from("camera_connector_devices")
    .select("id, remote_control_enabled, revoked_at, last_seen_at")
    .eq("id", camera.device_id)
    .maybeSingle();
  if (!device || device.revoked_at) return { ok: false, message: "Mac connector is not paired." };
  if (!device.remote_control_enabled) {
    return { ok: false, message: "Remote control is disabled on the Mac." };
  }

  const lease = await ensureControlLease(gate.supabase, {
    venueId: gate.context.venue.id,
    cameraId: camera.id,
    userId: gate.context.userId,
  });
  if (!lease.ok) return { ok: false, message: lease.message };

  const expiresAt = cameraCommandExpiresAt();
  const payload = ("payload" in parsed.data ? parsed.data.payload : {}) ?? {};
  const { data: command, error: insertError } = await gate.supabase
    .from("camera_commands")
    .insert({
      venue_id: gate.context.venue.id,
      camera_id: camera.id,
      device_id: camera.device_id,
      kind: parsed.data.kind,
      payload: payload as Json,
      issued_by: gate.context.userId,
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (insertError) return { ok: false, message: cameraSqlMessage(insertError.message) };

  await writeAudit(
    gate.context.venue.id,
    gate.context.userId,
    "command_issued",
    { kind: parsed.data.kind, expiresAt, ttlMs: CAMERA_COMMAND_TTL_MS },
    { deviceId: camera.device_id, cameraId: camera.id },
  );

  return {
    ok: true,
    message: "Command queued.",
    commandId: command.id,
    leaseExpiresAt: lease.expiresAt,
  };
}

export async function startCameraPreviewAction(input: unknown): Promise<CameraActionResult> {
  const gate = await staffGate("operate");
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = cameraPreviewStartSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  const { data: camera, error } = await gate.supabase
    .from("camera_sources")
    .select("id, device_id, online")
    .eq("id", parsed.data.cameraId)
    .eq("venue_id", gate.context.venue.id)
    .maybeSingle();
  if (error) return { ok: false, message: cameraSqlMessage(error.message) };
  if (!camera) return { ok: false, message: "Camera not found." };

  // End prior sessions for this user/camera.
  await gate.supabase
    .from("camera_preview_sessions")
    .update({ status: "ended" })
    .eq("camera_id", camera.id)
    .eq("requester_user_id", gate.context.userId)
    .in("status", ["requested", "active"]);

  const expiresAt = new Date(Date.now() + CAMERA_PREVIEW_TTL_MS).toISOString();
  const { data: session, error: insertError } = await gate.supabase
    .from("camera_preview_sessions")
    .insert({
      venue_id: gate.context.venue.id,
      camera_id: camera.id,
      device_id: camera.device_id,
      requester_user_id: gate.context.userId,
      mode: parsed.data.mode,
      status: "requested",
      offer_sdp: parsed.data.offerSdp ?? null,
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (insertError) return { ok: false, message: cameraSqlMessage(insertError.message) };

  await writeAudit(
    gate.context.venue.id,
    gate.context.userId,
    "preview_started",
    { mode: parsed.data.mode },
    { deviceId: camera.device_id, cameraId: camera.id },
  );

  return {
    ok: true,
    message: "Preview session requested.",
    previewSessionId: session.id,
    previewUrl: `/api/media/v1/cameras/preview/${session.id}`,
  };
}

export async function endCameraPreviewAction(input: unknown): Promise<CameraActionResult> {
  const gate = await staffGate("operate");
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = z.object({ sessionId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  await gate.supabase
    .from("camera_preview_sessions")
    .update({ status: "ended" })
    .eq("id", parsed.data.sessionId)
    .eq("venue_id", gate.context.venue.id)
    .eq("requester_user_id", gate.context.userId);

  return { ok: true, message: "Preview ended." };
}
