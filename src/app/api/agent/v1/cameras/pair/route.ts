import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  createCameraDeviceToken,
  hashCameraSecret,
  normalizePairingCode,
} from "@/lib/cameras/crypto";
import { isMissingCameraRelation } from "@/lib/cameras/status";
import { CAMERA_CONNECTOR_SQL } from "@/lib/constants";
import { cameraConnectorPairSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ error: "Pairing is not configured." }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }
  const parsed = cameraConnectorPairSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check the pairing payload." }, { status: 400 });

  const code = normalizePairingCode(parsed.data.code);
  if (code.length < 6) return NextResponse.json({ error: "Pairing code is invalid." }, { status: 400 });

  const codeHash = hashCameraSecret(code);
  const now = new Date();
  const { data: pairing, error: pairingError } = await admin
    .from("camera_connector_pairing_codes")
    .select("id, venue_id, expires_at, consumed_at")
    .eq("code_hash", codeHash)
    .maybeSingle();

  if (pairingError) {
    const message = isMissingCameraRelation(pairingError.message)
      ? `Apply ${CAMERA_CONNECTOR_SQL} before pairing.`
      : "Could not check the pairing code.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
  if (!pairing || pairing.consumed_at || Date.parse(pairing.expires_at) <= now.getTime()) {
    return NextResponse.json({ error: "Pairing code is invalid or expired." }, { status: 401 });
  }

  const { error: consumeError } = await admin
    .from("camera_connector_pairing_codes")
    .update({ consumed_at: now.toISOString() })
    .eq("id", pairing.id)
    .is("consumed_at", null);
  if (consumeError) return NextResponse.json({ error: "Could not consume pairing code." }, { status: 500 });

  const token = createCameraDeviceToken();
  const label = parsed.data.label?.trim() || "FloBama Mac";
  const { data: device, error: deviceError } = await admin
    .from("camera_connector_devices")
    .insert({
      venue_id: pairing.venue_id,
      label,
      token_hash: hashCameraSecret(token),
      hostname: parsed.data.hostname?.trim() || null,
      connector_version: parsed.data.connectorVersion?.trim() || null,
      last_seen_at: now.toISOString(),
      remote_control_enabled: true,
    })
    .select("id, venue_id, label")
    .single();
  if (deviceError || !device) {
    return NextResponse.json({ error: "Could not create device credential." }, { status: 500 });
  }

  await admin.from("camera_audit_log").insert({
    venue_id: pairing.venue_id,
    device_id: device.id,
    action: "device_paired",
    detail: {
      label: device.label,
      hostname: parsed.data.hostname ?? null,
      connectorVersion: parsed.data.connectorVersion ?? null,
    },
  });

  return NextResponse.json({
    deviceId: device.id,
    venueId: device.venue_id,
    label: device.label,
    token,
    pollMs: 750,
  });
}
