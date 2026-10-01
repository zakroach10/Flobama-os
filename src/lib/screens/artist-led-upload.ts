import { saveArtistLedMediaAction } from "@/actions/artist-led";
import type { PublicSupabaseEnv } from "@/lib/env";
import {
  artistLedFileMeta,
  artistLedMediaKindForFile,
  MAX_ARTIST_LED_BYTES,
} from "@/lib/screens/artist-led";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export async function uploadArtistLedMediaFromBrowser(input: {
  file: File;
  venueId: string;
  artistId: string;
  title: string;
  supabaseEnv: PublicSupabaseEnv | null;
}) {
  const mediaKind = artistLedMediaKindForFile(input.file);
  if (!mediaKind) {
    return { ok: false as const, message: "Use an MP4 loop or a PNG, JPEG, or HEIC logo." };
  }
  if (input.file.size === 0) {
    return { ok: false as const, message: "Choose an MP4, PNG, JPEG, or HEIC file." };
  }
  if (input.file.size > MAX_ARTIST_LED_BYTES) {
    return { ok: false as const, message: "File must be 2 GB or smaller." };
  }

  const supabase = createBrowserSupabaseClient(input.supabaseEnv);
  if (!supabase) {
    return {
      ok: false as const,
      message: "Supabase is not configured in this deployment.",
    };
  }

  const { ext, contentType } = artistLedFileMeta(input.file, mediaKind);
  const storagePath = `${input.venueId}/led/artists/${input.artistId}-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from("screen-ads").upload(storagePath, input.file, {
    contentType,
    upsert: false,
  });
  if (uploadError) return { ok: false as const, message: uploadError.message };

  const publicUrl = supabase.storage.from("screen-ads").getPublicUrl(storagePath).data.publicUrl;
  const result = await saveArtistLedMediaAction({
    artistId: input.artistId,
    title: input.title,
    mediaKind,
    storagePath,
    publicUrl,
  });
  if (!result.ok) {
    await supabase.storage.from("screen-ads").remove([storagePath]);
    return { ok: false as const, message: result.message };
  }
  return { ok: true as const, message: result.message };
}
