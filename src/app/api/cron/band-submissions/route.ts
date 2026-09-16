import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/notifications/auth";
import { notifyNewBandSubmissions } from "@/lib/notifications/jobs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function handle(request: Request) {
  const auth = authorizeCronRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const result = await notifyNewBandSubmissions();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
