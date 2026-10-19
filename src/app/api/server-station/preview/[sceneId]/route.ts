import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getPublicSupabaseEnv } from "@/lib/env";
import {
  buildScreenAdsPublicUrl,
  ledScenePosterStoragePath,
} from "@/lib/screens/led-poster";

export const revalidate = 86400;

const LONG_CACHE = "public, max-age=86400, stale-while-revalidate=604800";
const MISS_CACHE = "public, max-age=60";

function resizedStorageUrl(storagePath: string, supabaseUrl: string) {
  const base = supabaseUrl.replace(/\/$/, "");
  const cleaned = storagePath
    .replace(/^\//, "")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  // Grid tiles are ~104 CSS px; 240 covers 2–3x DPR without shipping full logos.
  const params = new URLSearchParams({
    width: "240",
    height: "240",
    resize: "contain",
    quality: "55",
  });
  return `${base}/storage/v1/render/image/public/screen-ads/${cleaned}?${params}`;
}

async function fetchImage(urls: string[]) {
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        next: { revalidate: 86_400 },
        headers: { Accept: "image/*,*/*;q=0.8" },
      });
      if (!response.ok) continue;
      const type = response.headers.get("content-type") || "";
      if (type && !type.startsWith("image/") && !type.includes("octet-stream")) continue;
      const bytes = await response.arrayBuffer();
      if (!bytes.byteLength) continue;
      return {
        bytes,
        contentType: type.startsWith("image/") ? type : "image/jpeg",
      };
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

/**
 * Public still for Server Station tiles. Scene media is already in the public
 * screen-ads bucket; serving stills without a cookie lets Vercel + the PWA
 * service worker cache them so the phone grid stays fast.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ sceneId: string }> },
) {
  const { sceneId } = await context.params;
  if (!sceneId) {
    return new NextResponse("Missing scene", { status: 400, headers: { "cache-control": "no-store" } });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return new NextResponse("Not configured", { status: 503, headers: { "cache-control": "no-store" } });
  }

  const { data: scene, error } = await admin
    .from("led_wall_scenes")
    .select("id, media_kind, storage_path, public_url, enabled, server_approved, artist_id, kind")
    .eq("id", sceneId)
    .maybeSingle();

  if (error) {
    return new NextResponse(error.message, { status: 500, headers: { "cache-control": "no-store" } });
  }
  if (!scene || !scene.enabled || scene.kind === "obs" || scene.kind === "trivia" || scene.kind === "audience") {
    return new NextResponse("Not found", { status: 404, headers: { "cache-control": MISS_CACHE } });
  }
  if (!scene.artist_id && !scene.server_approved) {
    return new NextResponse("Not found", { status: 404, headers: { "cache-control": MISS_CACHE } });
  }

  const env = getPublicSupabaseEnv();
  const path = scene.storage_path?.trim();
  const candidates: string[] = [];

  if (scene.media_kind === "video") {
    if (path && env?.url) {
      const posterPath = ledScenePosterStoragePath(path);
      candidates.push(resizedStorageUrl(posterPath, env.url));
      candidates.push(buildScreenAdsPublicUrl(posterPath, env.url));
    }
  } else if (path && env?.url) {
    candidates.push(resizedStorageUrl(path, env.url));
    candidates.push(buildScreenAdsPublicUrl(path, env.url));
  } else if (scene.public_url?.trim()) {
    candidates.push(scene.public_url.trim());
  }

  if (!candidates.length) {
    return new NextResponse("No preview", { status: 404, headers: { "cache-control": MISS_CACHE } });
  }

  const image = await fetchImage(candidates);
  if (!image) {
    // Missing loop poster — client falls back to a single muted video frame.
    return new NextResponse("Preview unavailable", { status: 404, headers: { "cache-control": MISS_CACHE } });
  }

  return new NextResponse(image.bytes, {
    status: 200,
    headers: {
      "content-type": image.contentType,
      "cache-control": LONG_CACHE,
      "cdn-cache-control": LONG_CACHE,
    },
  });
}
