import { NextResponse } from "next/server";
import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getSpotOnWebhookCredentials } from "@/lib/spoton/credentials";
import { authenticateSpotOnWebhook } from "@/lib/spoton/webhook";
import { persistAuthenticatedWebhook } from "@/lib/spoton/jobs/webhook-processor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * SpotOn Central API webhook receiver.
 * Signature: X-Spoton-Webhook-Signature (HMAC-SHA256 hex of raw body) + version v1.
 * Persists the authenticated event before returning success. Processing is durable
 * via inbox + cron — never an unawaited promise after the response.
 */
export async function POST(request: Request) {
  const rawBody = Buffer.from(await request.arrayBuffer());
  const credentials = getSpotOnWebhookCredentials();

  const auth = authenticateSpotOnWebhook({
    rawBody,
    signatureHeader: request.headers.get("x-spoton-webhook-signature"),
    signatureVersionHeader: request.headers.get("x-spoton-webhook-signature-version"),
    signatureKeyBase64: credentials?.signatureKeyBase64 ?? null,
    configuredLocationId: credentials?.locationId ?? null,
  });

  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.message },
      { status: auth.status },
    );
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Service unavailable" },
      { status: 500 },
    );
  }

  try {
    const persisted = await persistAuthenticatedWebhook({
      admin,
      venueId: FLO_BAMA_VENUE_ID,
      event: auth.event,
      rawBytes: auth.rawBytes,
    });
    // 200 acknowledges delivery (including duplicates) without re-applying effects.
    return NextResponse.json({
      ok: true,
      duplicate: persisted.duplicate,
      inboxId: persisted.inboxId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Persistence failed";
    // 500 → SpotOn retries delivery
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "spoton-webhook",
      signature: "Central API v1 HMAC-SHA256",
    },
    { status: 200 },
  );
}
