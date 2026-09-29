import { NextResponse } from "next/server";
import { authenticateCameraDevice, readBearerToken } from "@/lib/cameras/agent-auth";
import { isCommandExpired } from "@/lib/cameras/commands";
import { normalizeReportedCamera } from "@/lib/cameras/map";
import type { ConnectorReportedCamera } from "@/lib/cameras/types";
import { cameraConnectorSyncSchema } from "@/lib/validation/schemas";
import type { Json } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = readBearerToken(request);
  if (!token) return NextResponse.json({ error: "Device token required." }, { status: 401 });

  const auth = await authenticateCameraDevice(token);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }
  const parsed = cameraConnectorSyncSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check the sync payload." }, { status: 400 });

  const { admin, device } = auth;
  const now = new Date();
  const seenAt = now.toISOString();

  const { error: deviceError } = await admin
    .from("camera_connector_devices")
    .update({
      last_seen_at: seenAt,
      remote_control_enabled: parsed.data.remoteControlEnabled,
      hostname: parsed.data.hostname?.trim() || device.hostname,
      connector_version: parsed.data.connectorVersion?.trim() || device.connector_version,
    })
    .eq("id", device.id);
  if (deviceError) return NextResponse.json({ error: "Could not update device status." }, { status: 500 });

  // Apply command results from Mac (never replay expired pending later).
  for (const result of parsed.data.commandResults ?? []) {
    const patch: {
      status: "accepted" | "rejected" | "expired" | "completed";
      reject_reason?: string | null;
      accepted_at?: string;
      completed_at?: string;
    } = { status: result.status };
    if (result.status === "accepted") patch.accepted_at = seenAt;
    if (result.status === "completed" || result.status === "rejected" || result.status === "expired") {
      patch.completed_at = seenAt;
    }
    if (result.rejectReason) patch.reject_reason = result.rejectReason;
    await admin
      .from("camera_commands")
      .update(patch)
      .eq("id", result.id)
      .eq("device_id", device.id)
      .eq("status", "pending");
  }

  // Upsert reported cameras; mark missing keys offline.
  const reported = parsed.data.cameras.map((cam, index) =>
    normalizeReportedCamera(cam as ConnectorReportedCamera, index),
  );
  const { data: existing } = await admin
    .from("camera_sources")
    .select("id, source_key")
    .eq("device_id", device.id);

  const existingByKey = new Map((existing ?? []).map((row) => [row.source_key, row.id]));
  const seenKeys = new Set<string>();

  for (const cam of reported) {
    if (!cam.source_key) continue;
    seenKeys.add(cam.source_key);
    const existingId = existingByKey.get(cam.source_key);
    if (existingId) {
      await admin
        .from("camera_sources")
        .update({
          title: cam.title,
          protocol: cam.protocol,
          is_simulated: cam.is_simulated,
          is_program_output: cam.is_program_output,
          supports_ptz: cam.supports_ptz,
          supports_zoom: cam.supports_zoom,
          supports_presets: cam.supports_presets,
          supports_preset_save: cam.supports_preset_save,
          supports_focus: cam.supports_focus,
          online: cam.online,
          last_error: cam.last_error,
          sort_order: cam.sort_order,
          capabilities: cam.capabilities,
        })
        .eq("id", existingId);
    } else {
      await admin.from("camera_sources").insert({
        venue_id: device.venue_id,
        device_id: device.id,
        ...cam,
      });
    }
  }

  for (const row of existing ?? []) {
    if (!seenKeys.has(row.source_key)) {
      await admin
        .from("camera_sources")
        .update({ online: false, last_error: "Source no longer reported by Mac connector." })
        .eq("id", row.id);
    }
  }

  // Preview snapshot / WebRTC answer updates.
  for (const update of parsed.data.previewUpdates ?? []) {
    const { data: session } = await admin
      .from("camera_preview_sessions")
      .select("id, venue_id, status, expires_at")
      .eq("id", update.sessionId)
      .eq("device_id", device.id)
      .maybeSingle();
    if (!session || session.status === "ended") continue;
    if (Date.parse(session.expires_at) <= now.getTime()) {
      await admin.from("camera_preview_sessions").update({ status: "ended" }).eq("id", session.id);
      continue;
    }

    const patch: {
      status?: string;
      answer_sdp?: string | null;
      ice_trickle?: Json;
      snapshot_path?: string | null;
      snapshot_url?: string | null;
      snapshot_updated_at?: string | null;
    } = {};
    if (update.status) patch.status = update.status;
    if (update.error) {
      patch.status = "failed";
      patch.answer_sdp = null;
    }
    if (update.answerSdp !== undefined) patch.answer_sdp = update.answerSdp;
    if (update.iceTrickle) patch.ice_trickle = update.iceTrickle as Json;

    if (update.snapshotBase64) {
      const contentType = update.snapshotContentType ?? "image/jpeg";
      const ext = contentType === "image/png" ? "png" : "jpg";
      const path = `${device.venue_id}/${session.id}.${ext}`;
      const bytes = Buffer.from(update.snapshotBase64, "base64");
      if (bytes.length > 0 && bytes.length <= 2_000_000) {
        const { error: uploadError } = await admin.storage.from("camera-previews").upload(path, bytes, {
          contentType,
          upsert: true,
        });
        if (!uploadError) {
          patch.snapshot_path = path;
          patch.snapshot_updated_at = seenAt;
          patch.status = update.status ?? "active";
          // Opaque media route — not a public storage URL.
          patch.snapshot_url = `/api/media/v1/cameras/preview/${session.id}`;
        }
      }
    }

    if (Object.keys(patch).length > 0) {
      await admin.from("camera_preview_sessions").update(patch).eq("id", session.id);
    }
  }

  // Expire stale pending commands (do not hand them to the Mac).
  const { data: pending } = await admin
    .from("camera_commands")
    .select("id, kind, payload, camera_id, expires_at, status")
    .eq("device_id", device.id)
    .eq("status", "pending")
    .order("issued_at", { ascending: true })
    .limit(40);

  const deliverable: Array<{
    id: string;
    cameraId: string;
    kind: string;
    payload: Json;
    expiresAt: string;
  }> = [];

  for (const command of pending ?? []) {
    if (isCommandExpired(command.expires_at, now)) {
      await admin
        .from("camera_commands")
        .update({ status: "expired", completed_at: seenAt, reject_reason: "Command TTL expired before delivery." })
        .eq("id", command.id);
      continue;
    }
    if (!parsed.data.remoteControlEnabled && command.kind !== "ptz_stop") {
      await admin
        .from("camera_commands")
        .update({
          status: "rejected",
          completed_at: seenAt,
          reject_reason: "Remote control disabled on Mac.",
        })
        .eq("id", command.id);
      continue;
    }
    deliverable.push({
      id: command.id,
      cameraId: command.camera_id,
      kind: command.kind,
      payload: command.payload,
      expiresAt: command.expires_at,
    });
  }

  const { data: previewSessions } = await admin
    .from("camera_preview_sessions")
    .select("id, camera_id, mode, status, offer_sdp, expires_at")
    .eq("device_id", device.id)
    .in("status", ["requested", "active"])
    .gt("expires_at", seenAt)
    .order("created_at", { ascending: true })
    .limit(8);

  // Map camera ids to source keys for the Mac.
  const { data: sources } = await admin
    .from("camera_sources")
    .select("id, source_key")
    .eq("device_id", device.id);
  const keyById = new Map((sources ?? []).map((row) => [row.id, row.source_key]));

  return NextResponse.json({
    serverTime: seenAt,
    remoteControlEnabled: parsed.data.remoteControlEnabled,
    commands: deliverable.map((command) => ({
      ...command,
      sourceKey: keyById.get(command.cameraId) ?? null,
    })),
    previewSessions: (previewSessions ?? []).map((session) => ({
      id: session.id,
      cameraId: session.camera_id,
      sourceKey: keyById.get(session.camera_id) ?? null,
      mode: session.mode,
      status: session.status,
      offerSdp: session.offer_sdp,
      expiresAt: session.expires_at,
    })),
  });
}
