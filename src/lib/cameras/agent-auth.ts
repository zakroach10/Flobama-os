import { createServiceRoleClient } from "@/lib/supabase/admin";
import { cameraSecretsMatch, hashCameraSecret } from "@/lib/cameras/crypto";
import { isMissingCameraRelation } from "@/lib/cameras/status";
import { CAMERA_CONNECTOR_SQL } from "@/lib/constants";

export function readBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

export async function authenticateCameraDevice(token: string) {
  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false as const, status: 503, error: "Camera connector sync is not configured." };
  }

  const tokenHash = hashCameraSecret(token);
  const { data: device, error } = await admin
    .from("camera_connector_devices")
    .select(
      "id, venue_id, label, token_hash, revoked_at, remote_control_enabled, last_seen_at, connector_version, hostname",
    )
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    const message = isMissingCameraRelation(error.message)
      ? `Apply ${CAMERA_CONNECTOR_SQL} before starting the Mac connector.`
      : "Could not check the device credential.";
    return { ok: false as const, status: 503, error: message };
  }
  if (!device || device.revoked_at || !cameraSecretsMatch(device.token_hash, token)) {
    return { ok: false as const, status: 401, error: "Device credential was not recognized." };
  }

  return { ok: true as const, admin, device };
}
