import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { MediaAssetKind } from "@/lib/display-devices/types";

type Client = SupabaseClient<Database>;

export async function upsertMediaContentHash(
  client: Client,
  input: {
    venueId: string;
    assetKind: MediaAssetKind;
    assetId: string;
    storagePath: string;
    sha256?: string | null;
    sizeBytes?: number | null;
    mediaType?: string | null;
  },
) {
  const now = input.sha256 ? new Date().toISOString() : null;
  const { error } = await client.from("media_content_hashes").upsert(
    {
      venue_id: input.venueId,
      asset_kind: input.assetKind,
      asset_id: input.assetId,
      storage_path: input.storagePath,
      sha256: input.sha256 ?? null,
      size_bytes: input.sizeBytes ?? null,
      media_type: input.mediaType ?? null,
      computed_at: now,
    },
    { onConflict: "asset_kind,asset_id" },
  );
  return error;
}

/** Browser-safe SHA-256 hex for upload files (prefer for files under ~100 MB). */
export async function sha256HexFromBlob(blob: Blob) {
  const buffer = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function isSha256Hex(value: string | null | undefined) {
  return Boolean(value && /^[a-f0-9]{64}$/i.test(value));
}
