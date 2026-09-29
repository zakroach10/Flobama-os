import { createMenuSpecialRecordAction } from "@/actions/playlists";
import type { MenuSpecialCategory } from "@/lib/constants";
import { SPECIAL_DEFAULT_SECONDS } from "@/lib/constants";
import type { PublicSupabaseEnv } from "@/lib/env";
import { describeUploadFailure, extensionForFile, MAX_SCREEN_AD_BYTES, mediaKindForFile } from "@/lib/screens/upload";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export async function uploadMenuSpecialFromBrowser(input: {
  file: File;
  venueId: string;
  title: string;
  subtitle: string;
  category: MenuSpecialCategory;
  priceLabel: string;
  duration: string;
  startsAt: string;
  endsAt: string;
  addToPlaylistId?: string | null;
  supabaseEnv: PublicSupabaseEnv | null;
}) {
  const mediaKind = mediaKindForFile(input.file);
  if (!mediaKind) {
    return { ok: false as const, message: "Use an image (JPEG, PNG, WebP, GIF) or a video (MP4, WebM)." };
  }
  if (input.file.size === 0) return { ok: false as const, message: "Choose an image or video file." };
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
  const durationSeconds = input.duration.trim() ? Number(input.duration) : SPECIAL_DEFAULT_SECONDS;
  if (!Number.isFinite(durationSeconds) || durationSeconds < 1) {
    return { ok: false as const, message: "Enter a hold time between 1 and 600 seconds." };
  }

  const id = crypto.randomUUID();
  const ext = extensionForFile(input.file) ?? (mediaKind === "video" ? "mp4" : "jpg");
  const storagePath = `${input.venueId}/specials/${id}.${ext}`;

  const { error: uploadError } = await supabase.storage.from("screen-ads").upload(storagePath, input.file, {
    contentType: input.file.type || (mediaKind === "video" ? "video/mp4" : "image/jpeg"),
    upsert: false,
  });
  if (uploadError) return { ok: false as const, message: describeUploadFailure(uploadError.message) };

  const publicUrl = supabase.storage.from("screen-ads").getPublicUrl(storagePath).data.publicUrl;
  const toIso = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  };

  const result = await createMenuSpecialRecordAction({
    id,
    title,
    subtitle: input.subtitle,
    category: input.category,
    priceLabel: input.priceLabel,
    mediaKind,
    storagePath,
    publicUrl,
    durationSeconds,
    startsAt: toIso(input.startsAt),
    endsAt: toIso(input.endsAt),
    enabled: true,
    addToPlaylistId: input.addToPlaylistId ?? null,
  });
  if (!result.ok) {
    await supabase.storage.from("screen-ads").remove([storagePath]);
    return { ok: false as const, message: describeUploadFailure(result.message) };
  }
  return { ok: true as const, message: result.message, id: result.id ?? id };
}
