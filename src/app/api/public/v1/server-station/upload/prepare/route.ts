import { NextResponse } from "next/server";
import { z } from "zod";
import { prepareServerStationPhoneUpload } from "@/lib/server-station/phone-upload";

const bodySchema = z.object({
  token: z.string().min(20).max(2000),
  mediaKind: z.enum(["image", "video"]),
  uploadId: z.string().uuid(),
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

  const result = await prepareServerStationPhoneUpload(parsed.data);
  if (!result.ok) {
    const status = /expired|invalid|missing|used/i.test(result.message) ? 401 : 500;
    return NextResponse.json({ error: result.message }, { status });
  }

  return NextResponse.json({
    venueId: result.venueId,
    sessionId: result.sessionId,
    storagePath: result.storagePath,
    path: result.path,
    signedUrl: result.signedUrl,
    token: result.token,
    contentType: result.contentType,
    maxBytes: result.maxBytes,
  });
}
