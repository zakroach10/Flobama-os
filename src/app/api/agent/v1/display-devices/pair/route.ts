import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  createDisplayDeviceToken,
  hashDisplaySecret,
  normalizeDisplayPairingCode,
} from "@/lib/display-devices/crypto";
import { isMissingDisplayDeviceRelation } from "@/lib/display-devices/status";
import { DISPLAY_DEVICES_SQL } from "@/lib/constants";
import type { DisplayDeviceKind } from "@/lib/display-devices/types";
import { displayDevicePairSchema } from "@/lib/validation/schemas";
import type { Json } from "@/lib/database.types";

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
  const parsed = displayDevicePairSchema.safeParse(body);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; ");
    return NextResponse.json(
      { error: "Check the pairing payload.", detail },
      { status: 400 },
    );
  }

  const code = normalizeDisplayPairingCode(parsed.data.code);
  if (code.length < 6) {
    return NextResponse.json(
      { error: "Pairing code is invalid.", detail: "Use the 8-character code from Screens → Display devices." },
      { status: 400 },
    );
  }

  const codeHash = hashDisplaySecret(code);
  const now = new Date();
  const { data: pairing, error: pairingError } = await admin
    .from("display_device_pairing_codes")
    .select("id, venue_id, intended_kind, expires_at, consumed_at")
    .eq("code_hash", codeHash)
    .maybeSingle();

  if (pairingError) {
    const message = isMissingDisplayDeviceRelation(pairingError.message)
      ? `Apply ${DISPLAY_DEVICES_SQL} before pairing.`
      : "Could not check the pairing code.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
  if (!pairing || pairing.consumed_at || Date.parse(pairing.expires_at) <= now.getTime()) {
    return NextResponse.json({ error: "Pairing code is invalid or expired." }, { status: 401 });
  }

  if (parsed.data.kind && parsed.data.kind !== pairing.intended_kind) {
    return NextResponse.json({ error: "Pairing code is for a different device kind." }, { status: 403 });
  }

  const { error: consumeError } = await admin
    .from("display_device_pairing_codes")
    .update({ consumed_at: now.toISOString() })
    .eq("id", pairing.id)
    .is("consumed_at", null);
  if (consumeError) return NextResponse.json({ error: "Could not consume the pairing code." }, { status: 500 });

  const kind = pairing.intended_kind as DisplayDeviceKind;
  const token = createDisplayDeviceToken();
  const label =
    parsed.data.label?.trim() ||
    (kind === "led_runner" ? "FloBama Local Runner" : "FloBama Vertical Player");

  // One live LED runner per venue; vertical kiosks may have many.
  if (kind === "led_runner") {
    await admin
      .from("display_devices")
      .update({ revoked_at: now.toISOString() })
      .eq("venue_id", pairing.venue_id)
      .eq("kind", "led_runner")
      .is("revoked_at", null);
  }

  const { data: device, error: deviceError } = await admin
    .from("display_devices")
    .insert({
      venue_id: pairing.venue_id,
      label,
      kind,
      token_hash: hashDisplaySecret(token),
      hostname: parsed.data.hostname?.trim() || null,
      app_version: parsed.data.appVersion?.trim() || null,
      last_seen_at: now.toISOString(),
      capabilities: (parsed.data.capabilities ?? {}) as Json,
    })
    .select("id, venue_id, label, kind")
    .single();
  if (deviceError || !device) {
    return NextResponse.json({ error: "Could not create device credential." }, { status: 500 });
  }

  await admin.from("display_device_status").upsert(
    {
      device_id: device.id,
      venue_id: pairing.venue_id,
      reported_at: now.toISOString(),
    },
    { onConflict: "device_id" },
  );

  return NextResponse.json({
    deviceId: device.id,
    venueId: device.venue_id,
    token,
    kind: device.kind,
    label: device.label,
  });
}
