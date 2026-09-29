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
    .select("id, venue_id, requester_user_id, status, snapshot_path, snapshot_base64, expires_at, mode")
    .eq("id", sessionId)
    .maybeSingle();

  // Fallback select if snapshot_base64 column is missing.
  let row = session;
  if (error && /snapshot_base64/i.test(error.message)) {
    const fallback = await admin
      .from("camera_preview_sessions")
      .select("id, venue_id, requester_user_id, status, snapshot_path, expires_at, mode")
      .eq("id", sessionId)
      .maybeSingle();
    if (fallback.error || !fallback.data) {
      return NextResponse.json({ error: "Preview session not found." }, { status: 404 });
    }
    row = { ...fallback.data, snapshot_base64: null };
  } else if (error || !session) {
    return NextResponse.json({ error: "Preview session not found." }, { status: 404 });
  }

  if (!row || row.venue_id !== context.venue.id) {
    return NextResponse.json({ error: "Preview session not found." }, { status: 404 });
  }

  const canOperate = authorizeCameraOperate(context.role);
  if (!canOperate.allowed && row.requester_user_id !== context.userId) {
    return NextResponse.json({ error: "Not authorized for this preview." }, { status: 403 });
  }

  if (row.status === "ended" || row.status === "failed" || Date.parse(row.expires_at) <= Date.now()) {
    return NextResponse.json({ error: "Preview session ended." }, { status: 410 });
  }

  if (row.snapshot_base64) {
    const bytes = Buffer.from(row.snapshot_base64, "base64");
    const contentType = row.snapshot_path?.endsWith(".jpg") ? "image/jpeg" : "image/png";
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
        pragma: "no-cache",
        "x-preview-mode": row.mode,
        "x-preview-source": "inline",
        // Help Safari treat this as a displayable image, not a download.
        "content-disposition": "inline",
      },
    });
  }

  if (!row.snapshot_path) {
    return NextResponse.json(
      { error: "Snapshot not ready. Waiting for Mac connector…", status: row.status },
      { status: 404 },
    );
  }

  const { data: file, error: downloadError } = await admin.storage
    .from("camera-previews")
    .download(row.snapshot_path);
  if (downloadError || !file) {
    return NextResponse.json({ error: "Could not load preview frame." }, { status: 404 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const contentType = row.snapshot_path.endsWith(".png") ? "image/png" : "image/jpeg";
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
      pragma: "no-cache",
      "content-disposition": "inline",
      "x-preview-mode": row.mode,
      "x-preview-source": "storage",
    },
  });
}
