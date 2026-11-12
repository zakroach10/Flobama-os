import { NextResponse } from "next/server";
import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { getSiteUrl } from "@/lib/env";
import { photoBoothClientKey } from "@/lib/photo-booth/client-key";
import { sanitizePhotoBoothLabel } from "@/lib/photo-booth/frame";
import { photoBoothShareOrigin } from "@/lib/photo-booth/origin";
import { createPhotoBoothRepository } from "@/lib/photo-booth/supabase-repository";
import { acceptPhotoBoothUpload, purgeExpiredPhotoBoothCaptures } from "@/lib/photo-booth/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStore = { "cache-control": "no-store" };

export async function POST(request: Request) {
  const repo = createPhotoBoothRepository();
  if (!repo) {
    return NextResponse.json({ error: "Photo sharing isn't set up on this kiosk yet." }, { status: 503, headers: noStore });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Send the photo as a form upload." }, { status: 400, headers: noStore });
  }

  const photo = form.get("photo");
  if (!(photo instanceof File)) {
    return NextResponse.json({ error: "Choose a photo to keep." }, { status: 400, headers: noStore });
  }

  const labelRaw = form.get("eventLabel");
  const eventLabel = typeof labelRaw === "string" ? sanitizePhotoBoothLabel(labelRaw) : null;
  const bytes = new Uint8Array(await photo.arrayBuffer());
  try {
    const result = await acceptPhotoBoothUpload(repo, {
      bytes,
      eventLabel,
      clientKey: photoBoothClientKey(request),
      now: new Date(),
      venueId: FLO_BAMA_VENUE_ID,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.status, headers: noStore });
    }
    try {
      await purgeExpiredPhotoBoothCaptures(repo, new Date(), 8);
    } catch {
      // The cron route retries retention.
    }
    const origin = photoBoothShareOrigin(request, getSiteUrl(), process.env.VERCEL_URL);
    return NextResponse.json(
      {
        ok: true,
        shareUrl: `${origin}/p/${result.token}`,
        expiresAt: result.expiresAt,
      },
      { headers: noStore },
    );
  } catch {
    return NextResponse.json({ error: "Could not store that photo." }, { status: 500, headers: noStore });
  }
}
