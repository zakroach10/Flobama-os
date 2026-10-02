import type { PublicSupabaseEnv } from "@/lib/env";
import { describeUploadFailure, MAX_SCREEN_AD_BYTES } from "@/lib/screens/upload";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export async function uploadAudiencePictureFromBrowser(input: {
  file: File;
  venueId: string;
  supabaseEnv: PublicSupabaseEnv | null;
}) {
  const type = input.file.type;
  const isPng = type === "image/png" || input.file.name.toLowerCase().endsWith(".png");
  const isJpeg = type === "image/jpeg" || /\.jpe?g$/i.test(input.file.name);
  const isWebp = type === "image/webp" || input.file.name.toLowerCase().endsWith(".webp");
  if (!isPng && !isJpeg && !isWebp) {
    return { ok: false as const, message: "Use a PNG, JPG, or WebP picture." };
  }
  if (input.file.size === 0) return { ok: false as const, message: "Choose a picture file." };
  if (input.file.size > MAX_SCREEN_AD_BYTES) {
    return { ok: false as const, message: "Picture must be 50 MB or smaller." };
  }

  const supabase = createBrowserSupabaseClient(input.supabaseEnv);
  if (!supabase) {
    return {
      ok: false as const,
      message: "Supabase is not configured in this deployment.",
    };
  }

  const ext = isPng ? "png" : isWebp ? "webp" : "jpg";
  const contentType = isPng ? "image/png" : isWebp ? "image/webp" : "image/jpeg";
  const storagePath = `${input.venueId}/audience/pictures/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await supabase.storage.from("screen-ads").upload(storagePath, input.file, {
    contentType,
    upsert: false,
  });
  if (uploadError) {
    return { ok: false as const, message: describeUploadFailure(uploadError.message) };
  }

  const publicUrl = supabase.storage.from("screen-ads").getPublicUrl(storagePath).data.publicUrl;
  return {
    ok: true as const,
    message: "Picture uploaded.",
    publicUrl,
    storagePath,
  };
}
