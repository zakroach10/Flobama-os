import { saveLedScenePosterAction } from "@/actions/led-wall";
import type { PublicSupabaseEnv } from "@/lib/env";
import { extractVideoPosterPng } from "@/lib/screens/led-video-poster";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export async function uploadLedVideoPosterFromBrowser(input: {
  file: Blob;
  venueId: string;
  sceneId: string;
  supabaseEnv: PublicSupabaseEnv | null;
  /** Extra path segment, e.g. `artists/{artistId}` */
  folder?: string;
}): Promise<{ ok: true; storagePath: string; publicUrl: string } | { ok: false; message: string }> {
  const poster = await extractVideoPosterPng(input.file);
  if (!poster) {
    return {
      ok: false,
      message: "Could not render a PNG still from that video. Menus will show a placeholder until a poster is added.",
    };
  }

  const supabase = createBrowserSupabaseClient(input.supabaseEnv);
  if (!supabase) {
    return { ok: false, message: "Supabase is not configured in this deployment." };
  }

  const folder = input.folder?.replace(/^\/+|\/+$/g, "") || "led";
  const storagePath = `${input.venueId}/${folder}/${input.sceneId}-poster.png`;
  const { error: uploadError } = await supabase.storage.from("screen-ads").upload(storagePath, poster.blob, {
    contentType: "image/png",
    upsert: true,
  });
  if (uploadError) return { ok: false, message: uploadError.message };

  const publicUrl = supabase.storage.from("screen-ads").getPublicUrl(storagePath).data.publicUrl;
  return { ok: true, storagePath, publicUrl };
}

export type LedPosterBackfillScene = {
  id: string;
  title: string;
  media_kind: string | null;
  storage_path: string | null;
  poster_url: string | null;
  artist_id?: string | null;
};

/** Download each video without a poster and persist a PNG still. */
export async function backfillLedVideoPostersFromBrowser(input: {
  venueId: string;
  scenes: LedPosterBackfillScene[];
  supabaseEnv: PublicSupabaseEnv | null;
  onProgress?: (done: number, total: number, title: string) => void;
}): Promise<{ ok: true; generated: number; skipped: number; failed: string[] } | { ok: false; message: string }> {
  const supabase = createBrowserSupabaseClient(input.supabaseEnv);
  if (!supabase) {
    return { ok: false, message: "Supabase is not configured in this deployment." };
  }

  const targets = input.scenes.filter(
    (scene) => scene.media_kind === "video" && scene.storage_path && !scene.poster_url?.trim(),
  );
  let generated = 0;
  let skipped = input.scenes.length - targets.length;
  const failed: string[] = [];

  for (const [index, scene] of targets.entries()) {
    input.onProgress?.(index, targets.length, scene.title);
    try {
      const { data, error } = await supabase.storage.from("screen-ads").download(scene.storage_path!);
      if (error || !data) {
        failed.push(`${scene.title}: ${error?.message || "download failed"}`);
        continue;
      }

      const folder = scene.artist_id ? `led/artists` : "led";
      const uploaded = await uploadLedVideoPosterFromBrowser({
        file: data,
        venueId: input.venueId,
        sceneId: scene.id,
        supabaseEnv: input.supabaseEnv,
        folder,
      });
      if (!uploaded.ok) {
        failed.push(`${scene.title}: ${uploaded.message}`);
        continue;
      }

      const saved = await saveLedScenePosterAction({
        sceneId: scene.id,
        posterStoragePath: uploaded.storagePath,
        posterUrl: uploaded.publicUrl,
      });
      if (!saved.ok) {
        await supabase.storage.from("screen-ads").remove([uploaded.storagePath]);
        failed.push(`${scene.title}: ${saved.message}`);
        continue;
      }
      generated += 1;
    } catch (error) {
      failed.push(`${scene.title}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  input.onProgress?.(targets.length, targets.length, "Done");
  return { ok: true, generated, skipped, failed };
}
