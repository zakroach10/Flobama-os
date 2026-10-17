import { NextResponse } from "next/server";
import { z } from "zod";
import { completeWallPhoneUpload } from "@/lib/screens/wall-phone-upload";

const bodySchema = z.object({
  token: z.string().min(20).max(2000),
  sceneId: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  mediaKind: z.enum(["image", "video"]),
  storagePath: z.string().trim().min(1).max(500),
  publicUrl: z.string().trim().min(8).max(800),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  mediaType: z.string().trim().min(1).max(120).optional(),
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

  const result = await completeWallPhoneUpload(parsed.data);
  if (!result.ok) {
    const status = /expired|invalid|missing|does not match/i.test(result.message) ? 401 : 500;
    return NextResponse.json({ error: result.message }, { status });
  }

  return NextResponse.json({ ok: true, message: result.message, sceneId: result.sceneId });
}
