import { createServiceRoleClient } from "@/lib/supabase/admin";
import { displaySecretsMatch, hashDisplaySecret } from "@/lib/display-devices/crypto";
import { isMissingDisplayDeviceRelation } from "@/lib/display-devices/status";
import { DISPLAY_DEVICES_SQL } from "@/lib/constants";
import type { DisplayDeviceKind } from "@/lib/display-devices/types";

export function readBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

export async function authenticateDisplayDevice(token: string) {
  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false as const, status: 503, error: "Display device sync is not configured." };
  }

  const tokenHash = hashDisplaySecret(token);
  const { data: device, error } = await admin
    .from("display_devices")
    .select("id, venue_id, label, kind, token_hash, revoked_at, last_seen_at, app_version, hostname, capabilities")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    const message = isMissingDisplayDeviceRelation(error.message)
      ? `Apply ${DISPLAY_DEVICES_SQL} before pairing display devices.`
      : "Could not check the device credential.";
    return { ok: false as const, status: 503, error: message };
  }
  if (!device || device.revoked_at || !displaySecretsMatch(device.token_hash, token)) {
    return { ok: false as const, status: 401, error: "Device credential was not recognized." };
  }

  return {
    ok: true as const,
    admin,
    device: {
      ...device,
      kind: device.kind as DisplayDeviceKind,
    },
  };
}
