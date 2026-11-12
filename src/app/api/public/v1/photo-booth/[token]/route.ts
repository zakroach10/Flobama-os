import { NextResponse } from "next/server";
import { createPhotoBoothRepository } from "@/lib/photo-booth/supabase-repository";
import { resolvePhotoBoothShare } from "@/lib/photo-booth/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const privateHeaders = {
  "cache-control": "private, no-store",
  "x-content-type-options": "nosniff",
  "x-robots-tag": "noindex, nofollow",
  "referrer-policy": "no-referrer",
};

type Params = { params: Promise<{ token: string }> };

export async function GET(request: Request, { params }: Params) {
  const { token } = await params;
  const repo = createPhotoBoothRepository();
  if (!repo) {
    return NextResponse.json({ error: "Photo sharing isn't available right now." }, { status: 503, headers: privateHeaders });
  }

  try {
    const share = await resolvePhotoBoothShare(repo, token, new Date());
    if (!share.ok) {
      return NextResponse.json({ error: share.message }, { status: share.status, headers: privateHeaders });
    }
    const file = await repo.downloadJpeg(share.row.storagePath);
    if (!file.bytes) {
      return NextResponse.json({ error: "This photo isn't available." }, { status: 404, headers: privateHeaders });
    }
    const download = new URL(request.url).searchParams.get("download") === "1";
    return new NextResponse(Buffer.from(file.bytes), {
      status: 200,
      headers: {
        ...privateHeaders,
        "content-type": "image/jpeg",
        "content-disposition": `${download ? "attachment" : "inline"}; filename="flobama-photo.jpg"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Photo sharing isn't available right now." }, { status: 500, headers: privateHeaders });
  }
}
