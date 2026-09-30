import { saveArtistLedMediaAction } from "@/actions/artist-led";
import type { PublicSupabaseEnv } from "@/lib/env";
import { ledMediaKindForFile } from "@/lib/screens/led-wall";
import { MAX_SCREEN_AD_BYTES } from "@/lib/screens/upload";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export async function uploadArtistLedMediaFromBrowser(input: {
  file: File;
  venueId: string;
  artistId: string;
  title: string;
  supabaseEnv: PublicSupabaseEnv | null;
}) {
  const mediaKind = ledMediaKindForFile(input.file);
  if (!mediaKind) return { ok: false as const, message: "Use an MP4 loop or a PNG logo." };
  if (input.file.size === 0) return { ok: false as const, message: "Choose an MP4 or PNG file." };
  if (input.file.size > MAX_SCREEN_AD_BYTES) {
    return { ok: false as const, message: "File must be 50 MB or smaller." };
  }

  const supabase = createBrowserSupabaseClient(input.supabaseEnv);
  if (!supabase) {
    return {
      ok: false as const,
      message: "Supabase is not configured in this deployment.",
    };
  }

  const ext = mediaKind === "video" ? "mp4" : "png";
  const storagePath = `${input.venueId}/led/artists/${input.artistId}-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from("screen-ads").upload(storagePath, input.file, {
    contentType: mediaKind === "video" ? "video/mp4" : "image/png",
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
