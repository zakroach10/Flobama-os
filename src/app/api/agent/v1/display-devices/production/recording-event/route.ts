import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateDisplayDevice, readBearerToken } from "@/lib/display-devices/agent-auth";
import type { Json } from "@/lib/database.types";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  eventType: z.enum([
    "recording_started",
    "recording_finished",
    "broadcast_started",
    "broadcast_finished",
  ]),
  idempotencyKey: z.string().trim().min(1).max(200),
  path: z.string().trim().max(4000).nullable().optional(),
  pathValidated: z.boolean().optional(),
  sessionId: z.string().uuid().nullable().optional(),
  at: z.string().datetime().optional(),
  payload: z.record(z.string(), z.any()).optional(),
});

export async function POST(request: Request) {
  const token = readBearerToken(request);
  if (!token) return NextResponse.json({ error: "Device token required." }, { status: 401 });

  const auth = await authenticateDisplayDevice(token);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the recording event payload." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const row = {
    venue_id: auth.device.venue_id,
    device_id: auth.device.id,
    session_id: parsed.data.sessionId ?? null,
    event_type: parsed.data.eventType,
    path_text: parsed.data.path ?? null,
    path_validated: Boolean(parsed.data.pathValidated),
    idempotency_key: parsed.data.idempotencyKey,
    payload: {
      ...(parsed.data.payload || {}),
      at: parsed.data.at ?? now,
    } as Json,
    processed_at: now,
  };

  const { data, error } = await auth.admin
    .from("production_recording_events")
    .upsert(row, { onConflict: "venue_id,idempotency_key", ignoreDuplicates: true })
    .select("id, idempotency_key, created_at")
    .maybeSingle();

  if (error) {
    // Unique race: treat as idempotent success.
    if (/duplicate|unique/i.test(error.message)) {
      return NextResponse.json({ ok: true, deduped: true });
    }
    return NextResponse.json({ error: "Could not record event." }, { status: 500 });
  }

  // When ignoreDuplicates yields no row, the key already existed.
  if (!data) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  // Best-effort: stamp active session recording times for finished/started events.
  if (parsed.data.sessionId) {
    if (parsed.data.eventType === "recording_started") {
      await auth.admin
        .from("production_sessions")
        .update({
          recording_started_at: parsed.data.at ?? now,
          status: "recording",
          ecamm_recording_path: parsed.data.path ?? undefined,
        })
        .eq("id", parsed.data.sessionId)
        .eq("venue_id", auth.device.venue_id);
    }
    if (parsed.data.eventType === "recording_finished") {
      await auth.admin
        .from("production_sessions")
        .update({
          recording_ended_at: parsed.data.at ?? now,
          ecamm_recording_path: parsed.data.path ?? undefined,
        })
        .eq("id", parsed.data.sessionId)
        .eq("venue_id", auth.device.venue_id);
    }
  }

  return NextResponse.json({ ok: true, id: data.id, deduped: false });
}
