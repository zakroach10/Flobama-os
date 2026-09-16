import { NextResponse } from "next/server";
import { authorizeWebhookRequest } from "@/lib/notifications/auth";
import { extractBandWebhookPayload, notifyNewBandSubmissions } from "@/lib/notifications/jobs";
import { broadcastPushToVenue } from "@/lib/notifications/broadcast";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GoHighLevel workflow / inbound webhook for new Band Inquiry records.
 * Authenticate with Bearer GHL_WEBHOOK_SECRET (or CRON_SECRET), or ?secret=.
 */
export async function POST(request: Request) {
  const auth = authorizeWebhookRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const { id, name } = extractBandWebhookPayload(body);

  if (id) {
    const result = await notifyNewBandSubmissions({
      forceIds: [id],
      bandNamesById: { [id]: name ?? "New band submission" },
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  }

  // Workflow may only send a name — still notify without cursor id tracking.
  const result = await broadcastPushToVenue({
    title: "New band submission",
    body: name ?? "A new band inquiry landed in Booking.",
    url: "/booking/submissions",
  });

  return NextResponse.json(
    {
      ok: result.ok || result.skipped,
      message: result.message,
      notified: result.sent,
      newCount: 1,
      seeded: false,
    },
    { status: result.ok || result.skipped ? 200 : 500 },
  );
}
