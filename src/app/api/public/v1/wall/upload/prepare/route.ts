import { NextResponse } from "next/server";
import { z } from "zod";
import { prepareWallPhoneUpload } from "@/lib/screens/wall-phone-upload";

const bodySchema = z.object({
  token: z.string().min(20).max(2000),
  mediaKind: z.enum(["image", "video"]),
  sceneId: z.string().uuid(),
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
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid upload request." }, { status: 400 });
  }

  const result = await prepareWallPhoneUpload(parsed.data);
  if (!result.ok) {
    const status = /expired|invalid|missing/i.test(result.message) ? 401 : 500;
    return NextResponse.json({ error: result.message }, { status });
  }

  return NextResponse.json({
    venueId: result.venueId,
    storagePath: result.storagePath,
    path: result.path,
    signedUrl: result.signedUrl,
    token: result.token,
  });
}
