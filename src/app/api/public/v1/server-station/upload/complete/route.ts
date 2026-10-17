import { NextResponse } from "next/server";
import { z } from "zod";
import { completeServerStationPhoneUpload } from "@/lib/server-station/phone-upload";

const bodySchema = z.object({
  token: z.string().min(20).max(2000),
  storagePath: z.string().min(1).max(400),
  publicUrl: z.string().url(),
  mediaKind: z.enum(["image", "video"]),
  sha256: z.string().max(128).optional().nullable(),
  sizeBytes: z.number().int().positive().optional().nullable(),
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

  const result = await completeServerStationPhoneUpload(parsed.data);
  if (!result.ok) {
    const status = /expired|invalid|used/i.test(result.message) ? 401 : 500;
    return NextResponse.json({ error: result.message }, { status });
  }

  return NextResponse.json({ ok: true, message: result.message });
}
