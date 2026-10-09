import { createLedMediaSceneAction } from "@/actions/led-wall";
import type { PublicSupabaseEnv } from "@/lib/env";
import { LED_WALL_SQL } from "@/lib/constants";
import { ledMediaKindForFile, MAX_LED_MEDIA_BYTES } from "@/lib/screens/led-wall";
import {
  uploadStorageObjectWithProgress,
  type StorageUploadProgress,
} from "@/lib/screens/storage-upload-progress";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export type LedMediaUploadPhase = "uploading" | "saving";

function describeLedUploadFailure(message: string) {
  if (/maximum allowed size|payload too large|entity too large/i.test(message)) {
    return "File must be 2 GB or smaller. Apply supabase/migrations/20261009000037_screen_led_loops_2gb.sql if the screen-ads bucket is still capped at 50 MB.";
  }
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
  onProgress?: (progress: StorageUploadProgress) => void;
  onPhase?: (phase: LedMediaUploadPhase) => void;
}) {
  const mediaKind = ledMediaKindForFile(input.file);
  if (!mediaKind) return { ok: false as const, message: "Use an MP4 loop or a PNG." };
  if (input.file.size === 0) return { ok: false as const, message: "Choose an MP4 or PNG file." };
  if (input.file.size > MAX_LED_MEDIA_BYTES) {
    return { ok: false as const, message: "File must be 2 GB or smaller." };
  }

  if (!input.supabaseEnv) {
    return {
      ok: false as const,
      message:
        "The public Supabase URL and anon key are missing from this deployment. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    };
  }

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
  const contentType = mediaKind === "video" ? "video/mp4" : "image/png";
  const storagePath = `${input.venueId}/led/${id}.${ext}`;

  input.onPhase?.("uploading");
  const uploadResult = await uploadStorageObjectWithProgress({
    supabase,
    supabaseEnv: input.supabaseEnv,
    bucket: "screen-ads",
    path: storagePath,
    file: input.file,
    contentType,
    upsert: false,
    onProgress: input.onProgress,
  });
  if (!uploadResult.ok) return { ok: false as const, message: describeLedUploadFailure(uploadResult.message) };

  input.onPhase?.("saving");
  const publicUrl = supabase.storage.from("screen-ads").getPublicUrl(storagePath).data.publicUrl;
  const result = await createLedMediaSceneAction({
    id,
    title,
    mediaKind,
    storagePath,
    publicUrl,
  });
  if (!result.ok) {
    await supabase.storage.from("screen-ads").remove([storagePath]);
    return { ok: false as const, message: describeLedUploadFailure(result.message) };
  }
  return { ok: true as const, message: result.message, id };
}
