import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { PHOTO_BOOTH_BUCKET } from "@/lib/photo-booth/constants";
import type { PhotoBoothCaptureInsert, PhotoBoothCaptureRow, PhotoBoothRepository } from "@/lib/photo-booth/repository";
import { createServiceRoleClient } from "@/lib/supabase/admin";

type Admin = SupabaseClient<Database>;

type CaptureDbRow = Database["public"]["Tables"]["photo_booth_captures"]["Row"];

function mapCapture(row: CaptureDbRow): PhotoBoothCaptureRow {
  return {
    id: row.id,
    venueId: row.venue_id,
    storagePath: row.storage_path,
    tokenHash: row.token_hash,
    byteSize: row.byte_size,
    eventLabel: row.event_label,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    purgedAt: row.purged_at,
  };
}

export function createPhotoBoothRepository(): PhotoBoothRepository | null {
  const admin = createServiceRoleClient();
  if (!admin) return null;
  return createSupabasePhotoBoothRepository(admin);
}

export function createSupabasePhotoBoothRepository(admin: Admin): PhotoBoothRepository {
  return {
    async countHits(bucketKey, sinceIso) {
      const { count, error } = await admin
        .from("photo_booth_rate_hits")
        .select("id", { count: "exact", head: true })
        .eq("bucket_key", bucketKey)
        .gte("created_at", sinceIso);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    async insertHit(bucketKey, atIso) {
      const { error } = await admin.from("photo_booth_rate_hits").insert({
        bucket_key: bucketKey,
        created_at: atIso,
      });
      if (error) throw new Error(error.message);
    },
    async deleteHitsBefore(beforeIso) {
      const { error } = await admin.from("photo_booth_rate_hits").delete().lt("created_at", beforeIso);
      if (error) throw new Error(error.message);
    },
    async uploadJpeg(path, bytes) {
      const { error } = await admin.storage.from(PHOTO_BOOTH_BUCKET).upload(path, Buffer.from(bytes), {
        contentType: "image/jpeg",
        upsert: false,
      });
      return { error: error?.message ?? null };
    },
    async deleteObject(path) {
      const { error } = await admin.storage.from(PHOTO_BOOTH_BUCKET).remove([path]);
      return { error: error?.message ?? null };
    },
    async downloadJpeg(path) {
      const { data, error } = await admin.storage.from(PHOTO_BOOTH_BUCKET).download(path);
      if (error || !data) return { bytes: null, error: error?.message ?? "Photo file is missing." };
      return { bytes: new Uint8Array(await data.arrayBuffer()), error: null };
    },
    async insertCapture(row: PhotoBoothCaptureInsert) {
      const { error } = await admin.from("photo_booth_captures").insert({
        id: row.id,
        venue_id: row.venueId,
        storage_path: row.storagePath,
        token_hash: row.tokenHash,
        byte_size: row.byteSize,
        event_label: row.eventLabel,
        created_at: row.createdAt,
        expires_at: row.expiresAt,
      });
      return { error: error?.message ?? null };
    },
    async findByTokenHash(tokenHash) {
      const { data, error } = await admin
        .from("photo_booth_captures")
        .select("id, venue_id, storage_path, token_hash, byte_size, content_type, event_label, created_at, expires_at, purged_at")
        .eq("token_hash", tokenHash)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapCapture(data) : null;
    },
    async listDueForPurge(nowIso, limit) {
      const { data, error } = await admin
        .from("photo_booth_captures")
        .select("id, venue_id, storage_path, token_hash, byte_size, content_type, event_label, created_at, expires_at, purged_at")
        .is("purged_at", null)
        .lte("expires_at", nowIso)
        .order("expires_at", { ascending: true })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapCapture);
    },
    async markPurged(id, atIso) {
      const { error } = await admin.from("photo_booth_captures").update({ purged_at: atIso }).eq("id", id);
      if (error) throw new Error(error.message);
    },
  };
}
