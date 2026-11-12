import { NextResponse } from "next/server";
import { getCronSecret } from "@/lib/env";
import { createPhotoBoothRepository } from "@/lib/photo-booth/supabase-repository";
import { purgeExpiredPhotoBoothCaptures } from "@/lib/photo-booth/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(request: Request) {
  const secret = getCronSecret();
  const header = request.headers.get("authorization");
  if (secret && header === `Bearer ${secret}`) return true;
  if (request.headers.get("x-vercel-cron") === "1") return true;
  return false;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const repo = createPhotoBoothRepository();
  if (!repo) {
    return NextResponse.json({ error: "Service role is not configured." }, { status: 503 });
  }
  try {
    const result = await purgeExpiredPhotoBoothCaptures(repo, new Date(), 200);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Photo booth purge failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
