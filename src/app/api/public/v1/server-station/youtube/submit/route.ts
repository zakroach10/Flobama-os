import { NextResponse } from "next/server";
import { z } from "zod";
import { submitServerStationYoutubeLink } from "@/lib/server-station/phone-upload";

const bodySchema = z.object({
  token: z.string().min(20).max(2000),
  url: z.string().trim().min(8).max(800),
  title: z.string().trim().max(160).optional().nullable(),
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid YouTube link request." },
      { status: 400 },
    );
  }

  const result = await submitServerStationYoutubeLink({
    token: parsed.data.token,
    url: parsed.data.url,
    title: parsed.data.title,
  });
  if (!result.ok) {
    const status = /expired|invalid|used|not YouTube/i.test(result.message) ? 401 : 400;
    return NextResponse.json({ error: result.message }, { status });
  }

  return NextResponse.json({
    ok: true,
    message: result.message,
    videoId: result.videoId,
    watchUrl: result.watchUrl,
    title: result.title,
  });
}
