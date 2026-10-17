import { createServiceRoleClient } from "@/lib/supabase/admin";
import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { verifyWallLedUploadToken } from "@/lib/screens/wall-upload-token";
import { isMissingLedWallRelation } from "@/lib/screens/led-wall";
import { revalidatePath } from "next/cache";

export function revalidateAfterWallPhoneUpload() {
  revalidatePath("/screens");
  revalidatePath("/display/led");
  revalidatePath("/api/public/v1/screens/led");
}

export async function prepareWallPhoneUpload(input: {
  token: string;
  mediaKind: "image" | "video";
  sceneId: string;
}) {
  const verified = verifyWallLedUploadToken(input.token);
  if (!verified.ok) return { ok: false as const, message: verified.message };

  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false as const, message: "Server storage is not configured for phone uploads." };
  }

  const ext = input.mediaKind === "video" ? "mp4" : "png";
  const storagePath = `${verified.payload.venueId}/led/${input.sceneId}.${ext}`;
  const { data, error } = await admin.storage.from("screen-ads").createSignedUploadUrl(storagePath);
  if (error || !data) {
    return { ok: false as const, message: error?.message ?? "Could not prepare the upload." };
  }

  return {
    ok: true as const,
    venueId: verified.payload.venueId,
    storagePath,
    path: data.path,
    signedUrl: data.signedUrl,
    token: data.token,
  };
}

export async function completeWallPhoneUpload(input: {
  token: string;
  sceneId: string;
  title: string;
  mediaKind: "image" | "video";
  storagePath: string;
  publicUrl: string;
  sha256?: string;
  sizeBytes?: number;
  mediaType?: string;
}) {
  const verified = verifyWallLedUploadToken(input.token);
  if (!verified.ok) return { ok: false as const, message: verified.message };

  const expectedPrefix = `${verified.payload.venueId}/led/`;
  if (!input.storagePath.startsWith(expectedPrefix)) {
    return { ok: false as const, message: "Upload path does not match this venue." };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false as const, message: "Server storage is not configured for phone uploads." };
  }

  const { count } = await admin
    .from("led_wall_scenes")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", verified.payload.venueId);

  const { error } = await admin.from("led_wall_scenes").insert({
    id: input.sceneId,
    venue_id: verified.payload.venueId,
    title: input.title,
    kind: "media",
    media_kind: input.mediaKind,
    storage_path: input.storagePath,
    public_url: input.publicUrl,
    sort_order: count ?? 0,
    enabled: true,
  });
  if (error) {
    if (isMissingLedWallRelation(error.message)) {
      return { ok: false as const, message: "LED wall tables are missing on this project." };
    }
    return { ok: false as const, message: error.message };
  }

  if (input.sha256 || input.sizeBytes != null) {
    const { upsertMediaContentHash } = await import("@/lib/display-devices/hashes");
    await upsertMediaContentHash(admin, {
      venueId: verified.payload.venueId || FLO_BAMA_VENUE_ID,
      assetKind: "led_scene",
      assetId: input.sceneId,
      storagePath: input.storagePath,
      sha256: input.sha256 ?? null,
      sizeBytes: input.sizeBytes ?? null,
      mediaType: input.mediaType ?? null,
    });
  }

  revalidateAfterWallPhoneUpload();
  return { ok: true as const, message: `${input.title} is ready on the wall dashboard.`, sceneId: input.sceneId };
}
