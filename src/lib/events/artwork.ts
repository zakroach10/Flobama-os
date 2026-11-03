import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { MAX_ARTIST_LED_BYTES } from "@/lib/screens/artist-led";

type Client = SupabaseClient<Database>;

/** Integration logos are capped below the 2 GB LED loop limit. Videos match the staff LED limit. */
export const INTEGRATION_ARTWORK_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

export const INTEGRATION_ARTWORK_CONTENT_TYPES = {
  "image/png": { ext: "png", mediaKind: "image", maxBytes: INTEGRATION_ARTWORK_IMAGE_MAX_BYTES },
  "image/jpeg": { ext: "jpg", mediaKind: "image", maxBytes: INTEGRATION_ARTWORK_IMAGE_MAX_BYTES },
  "image/heic": { ext: "heic", mediaKind: "image", maxBytes: INTEGRATION_ARTWORK_IMAGE_MAX_BYTES },
  "image/heif": { ext: "heif", mediaKind: "image", maxBytes: INTEGRATION_ARTWORK_IMAGE_MAX_BYTES },
  "video/mp4": { ext: "mp4", mediaKind: "video", maxBytes: MAX_ARTIST_LED_BYTES },
} as const;

export type IntegrationArtworkContentType = keyof typeof INTEGRATION_ARTWORK_CONTENT_TYPES;

export function integrationArtworkSpec(contentType: string) {
  if (contentType in INTEGRATION_ARTWORK_CONTENT_TYPES) {
    return INTEGRATION_ARTWORK_CONTENT_TYPES[contentType as IntegrationArtworkContentType];
  }
  return null;
}

export function artistArtworkStoragePath(venueId: string, artistId: string, extension: string, suffix: string) {
  return `${venueId}/led/artists/${artistId}-${suffix}.${extension}`;
}

export function isArtistArtworkStoragePath(venueId: string, artistId: string, storagePath: string): boolean {
  const pattern = new RegExp(
    `^${escapeRegExp(venueId)}/led/artists/${escapeRegExp(artistId)}-[A-Za-z0-9_-]{8,80}\\.(png|jpe?g|heic|heif|mp4)$`,
  );
  return pattern.test(storagePath);
}

export function artworkExtension(storagePath: string): string | null {
  const match = /\.([A-Za-z0-9]+)$/.exec(storagePath);
  return match?.[1]?.toLowerCase() ?? null;
}

export function contentTypeMatchesArtworkPath(contentType: string, storagePath: string): boolean {
  const spec = integrationArtworkSpec(contentType);
  if (!spec) return false;
  const extension = artworkExtension(storagePath);
  if (!extension) return false;
  if (spec.ext === "jpg") return extension === "jpg" || extension === "jpeg";
  return extension === spec.ext;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Same artist LED scene write the staff artist page uses.
 * The caller has already checked the artist belongs to the venue.
 */
export async function upsertArtistLedMedia(
  client: Client,
  input: {
    venueId: string;
    artistId: string;
    title: string;
    mediaKind: "image" | "video";
    storagePath: string;
    publicUrl: string;
  },
): Promise<{ ok: true; sceneId: string } | { ok: false; message: string }> {
  const { data: existing, error: existingError } = await client
    .from("led_wall_scenes")
    .select("id")
    .eq("venue_id", input.venueId)
    .eq("artist_id", input.artistId)
    .maybeSingle();
  if (existingError) return { ok: false, message: existingError.message };

  if (existing) {
    const { error } = await client
      .from("led_wall_scenes")
      .update({
        title: input.title,
        kind: "media",
        media_kind: input.mediaKind,
        storage_path: input.storagePath,
        public_url: input.publicUrl,
        obs_scene_name: null,
        enabled: true,
      })
      .eq("id", existing.id)
      .eq("venue_id", input.venueId);
    if (error) return { ok: false, message: error.message };
    return { ok: true, sceneId: existing.id };
  }

  const { data, error } = await client
    .from("led_wall_scenes")
    .insert({
      venue_id: input.venueId,
      title: input.title,
      kind: "media",
      media_kind: input.mediaKind,
      storage_path: input.storagePath,
      public_url: input.publicUrl,
      artist_id: input.artistId,
      enabled: true,
      sort_order: 9999,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "Could not save artist artwork." };
  return { ok: true, sceneId: data.id };
}
