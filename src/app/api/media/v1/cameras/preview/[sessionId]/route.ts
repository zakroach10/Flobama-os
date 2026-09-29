import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/auth/staff";
import { authorizeCameraOperate, authorizeCameraView } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ sessionId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { sessionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) {
    return NextResponse.json({ error: "Invalid session." }, { status: 400 });
  }

  const context = await getStaffContext();
  if (context.status !== "ok") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const canView = authorizeCameraView(context.role);
  if (!canView.allowed) {
    return NextResponse.json({ error: canView.reason }, { status: 403 });
  }

  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ error: "Preview is not configured." }, { status: 503 });

  const { data: session, error } = await admin
    .from("camera_preview_sessions")
    .select("id, venue_id, requester_user_id, status, snapshot_path, expires_at, mode")
    .eq("id", sessionId)
    .maybeSingle();
  if (error || !session) return NextResponse.json({ error: "Preview session not found." }, { status: 404 });
  if (session.venue_id !== context.venue.id) {
    return NextResponse.json({ error: "Preview session not found." }, { status: 404 });
  }

  // Operators can view any venue preview; viewers only their own if somehow created (they cannot start).
  const canOperate = authorizeCameraOperate(context.role);
  if (!canOperate.allowed && session.requester_user_id !== context.userId) {
    return NextResponse.json({ error: "Not authorized for this preview." }, { status: 403 });
  }

  if (session.status === "ended" || session.status === "failed" || Date.parse(session.expires_at) <= Date.now()) {
    return NextResponse.json({ error: "Preview session ended." }, { status: 410 });
  }
  if (!session.snapshot_path) {
    return NextResponse.json({ error: "Snapshot not ready.", status: session.status }, { status: 404 });
  }

  const { data: file, error: downloadError } = await admin.storage
    .from("camera-previews")
    .download(session.snapshot_path);
  if (downloadError || !file) {
    return NextResponse.json({ error: "Could not load preview frame." }, { status: 404 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const contentType = session.snapshot_path.endsWith(".png") ? "image/png" : "image/jpeg";
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": "no-store, max-age=0",
      "x-preview-mode": session.mode,
    },
  });
}
