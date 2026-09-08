import { createScreenAdRecordAction } from "@/actions/screens";
import type { PublicSupabaseEnv } from "@/lib/env";
import type { ScreenTransition } from "@/lib/constants";
import { describeUploadFailure, extensionForFile, MAX_SCREEN_AD_BYTES, mediaKindForFile } from "@/lib/screens/upload";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export async function uploadScreenAdFromBrowser(input: {
  file: File;
  venueId: string;
  title: string;
  duration: string;
  transition: ScreenTransition;
  sortOrder: number;
  enabled?: boolean;
  supabaseEnv: PublicSupabaseEnv | null;
}) {
  const mediaKind = mediaKindForFile(input.file);
  if (!mediaKind) return { ok: false as const, message: "Use an image (JPEG, PNG, WebP, GIF) or a video (MP4, WebM)." };
  if (input.file.size === 0) return { ok: false as const, message: "Choose an image or video file." };
  if (input.file.size > MAX_SCREEN_AD_BYTES) return { ok: false as const, message: "File must be 50 MB or smaller." };

  const supabase = createBrowserSupabaseClient(input.supabaseEnv);
  if (!supabase) {
    return {
      ok: false as const,
      message:
        "The public Supabase URL and anon key are missing from this deployment. SQL is not the issue — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY on Vercel.",
    };
  }

  const title = input.title.trim() || input.file.name.replace(/\.[^.]+$/, "");
  const durationSeconds = input.duration.trim()
    ? Number(input.duration)
    : mediaKind === "image"
      ? 10
      : null;
  const id = crypto.randomUUID();
  const ext = extensionForFile(input.file) ?? (mediaKind === "video" ? "mp4" : "jpg");
  const storagePath = `${input.venueId}/${id}.${ext}`;

  const { error: uploadError } = await supabase.storage.from("screen-ads").upload(storagePath, input.file, {
    contentType: input.file.type || (mediaKind === "video" ? "video/mp4" : "image/jpeg"),
    upsert: false,
  });
  if (uploadError) return { ok: false as const, message: describeUploadFailure(uploadError.message) };

  const publicUrl = supabase.storage.from("screen-ads").getPublicUrl(storagePath).data.publicUrl;
  const result = await createScreenAdRecordAction({
    id,
    title,
    durationSeconds,
    transition: input.transition,
    enabled: input.enabled ?? true,
    mediaKind,
    storagePath,
    publicUrl,
    sortOrder: input.sortOrder,
  });
  if (!result.ok) {
    await supabase.storage.from("screen-ads").remove([storagePath]);
    return { ok: false as const, message: describeUploadFailure(result.message) };
  }
  return { ok: true as const, message: result.message, id: result.id ?? id };
}
