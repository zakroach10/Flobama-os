import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/notifications/auth";
import { sendWeeklyScheduleReminder } from "@/lib/notifications/jobs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function handle(request: Request) {
  const auth = authorizeCronRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";
  const result = await sendWeeklyScheduleReminder({ force });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
