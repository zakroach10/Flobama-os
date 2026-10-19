import { NextResponse } from "next/server";
import { getServerStationGate } from "@/lib/server-station/context";
import { ledScenePosterStoragePath } from "@/lib/screens/led-poster";

export const dynamic = "force-dynamic";

const MAX_POSTER_BYTES = 900_000;

/**
 * Persist a JPEG still for an MP4 loop so Server Station grid tiles load as
 * tiny images instead of re-decoding the video on every phone visit.
 */
export async function POST(request: Request) {
  const gate = await getServerStationGate("access");
  if (!gate.ok) {
    return NextResponse.json({ ok: false, message: gate.message }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid form body." }, { status: 400 });
  }

  const sceneId = String(form.get("sceneId") ?? "").trim();
  const file = form.get("poster");
  if (!sceneId || !(file instanceof File)) {
    return NextResponse.json({ ok: false, message: "sceneId and poster are required." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_POSTER_BYTES) {
    return NextResponse.json({ ok: false, message: "Poster must be a small JPEG." }, { status: 400 });
  }
  if (file.type && file.type !== "image/jpeg" && file.type !== "image/jpg") {
    return NextResponse.json({ ok: false, message: "Poster must be JPEG." }, { status: 400 });
  }

  const { data: scene, error: sceneError } = await gate.writeClient
    .from("led_wall_scenes")
    .select("id, venue_id, media_kind, storage_path")
    .eq("id", sceneId)
    .eq("venue_id", gate.venueId)
    .maybeSingle();

  if (sceneError) {
    return NextResponse.json({ ok: false, message: sceneError.message }, { status: 500 });
  }
  if (!scene || scene.media_kind !== "video" || !scene.storage_path) {
    return NextResponse.json({ ok: false, message: "Scene is not a video loop." }, { status: 400 });
  }

  const posterPath = ledScenePosterStoragePath(scene.storage_path);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await gate.writeClient.storage.from("screen-ads").upload(posterPath, bytes, {
    contentType: "image/jpeg",
    upsert: true,
    cacheControl: "86400",
  });
  if (uploadError) {
    return NextResponse.json({ ok: false, message: uploadError.message }, { status: 500 });
  }

  const publicUrl = gate.writeClient.storage.from("screen-ads").getPublicUrl(posterPath).data.publicUrl;
  return NextResponse.json({ ok: true, posterUrl: publicUrl });
}
