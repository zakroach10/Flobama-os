import { createLedMediaSceneAction } from "@/actions/led-wall";
import type { PublicSupabaseEnv } from "@/lib/env";
import { LED_WALL_SQL } from "@/lib/constants";
import { ledMediaKindForFile } from "@/lib/screens/led-wall";
import { MAX_SCREEN_AD_BYTES } from "@/lib/screens/upload";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

function describeLedUploadFailure(message: string) {
  if (/bucket not found|not found|row-level security|violates/i.test(message)) {
    return `${message} Apply ${LED_WALL_SQL} if the LED wall tables are missing. Uploads use the screen-ads bucket from supabase/migrations/20260908000005_screens.sql.`;
  }
  return message;
}

export async function uploadLedMediaFromBrowser(input: {
  file: File;
  venueId: string;
  title: string;
  supabaseEnv: PublicSupabaseEnv | null;
  rollsUntilShowtime?: boolean;
}) {
  const mediaKind = ledMediaKindForFile(input.file);
  if (!mediaKind) return { ok: false as const, message: "Use an MP4 loop or a PNG." };
  if (input.file.size === 0) return { ok: false as const, message: "Choose an MP4 or PNG file." };
  if (input.file.size > MAX_SCREEN_AD_BYTES) return { ok: false as const, message: "File must be 50 MB or smaller." };

  const supabase = createBrowserSupabaseClient(input.supabaseEnv);
  if (!supabase) {
    return {
      ok: false as const,
      message:
        "The public Supabase URL and anon key are missing from this deployment. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    };
  }

  const title = input.title.trim() || input.file.name.replace(/\.[^.]+$/, "");
  const id = crypto.randomUUID();
  const ext = mediaKind === "video" ? "mp4" : "png";
  const storagePath = `${input.venueId}/led/${id}.${ext}`;

  const { error: uploadError } = await supabase.storage.from("screen-ads").upload(storagePath, input.file, {
    contentType: mediaKind === "video" ? "video/mp4" : "image/png",
    upsert: false,
  });
  if (uploadError) return { ok: false as const, message: describeLedUploadFailure(uploadError.message) };

  const publicUrl = supabase.storage.from("screen-ads").getPublicUrl(storagePath).data.publicUrl;
  const result = await createLedMediaSceneAction({
    id,
    title,
    mediaKind,
    storagePath,
    publicUrl,
    rollsUntilShowtime: mediaKind === "video" && input.rollsUntilShowtime === true,
  });
  if (!result.ok) {
    await supabase.storage.from("screen-ads").remove([storagePath]);
    return { ok: false as const, message: describeLedUploadFailure(result.message) };
  }
  return { ok: true as const, message: result.message, id };
}
