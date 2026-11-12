import { createPhotoBoothRepository } from "@/lib/photo-booth/supabase-repository";
import { resolvePhotoBoothShare } from "@/lib/photo-booth/service";

export async function loadPhotoBoothShare(token: string, now = new Date()) {
  const repo = createPhotoBoothRepository();
  if (!repo) {
    return { ok: false as const, message: "Photo sharing isn't available right now." };
  }
  try {
    const share = await resolvePhotoBoothShare(repo, token, now);
    if (!share.ok) return { ok: false as const, message: share.message };
    return {
      ok: true as const,
      eventLabel: share.row.eventLabel,
      expiresAt: share.row.expiresAt,
    };
  } catch {
    return { ok: false as const, message: "Photo sharing isn't available right now." };
  }
}
