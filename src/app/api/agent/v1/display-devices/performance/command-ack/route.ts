import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateDisplayDevice, readBearerToken } from "@/lib/display-devices/agent-auth";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  commandResults: z
    .array(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["accepted", "rejected", "expired", "completed"]),
        rejectReason: z.string().trim().max(300).nullable().optional(),
      }),
    )
    .max(100),
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
    return NextResponse.json({ error: "Check the command ack payload." }, { status: 400 });
  }

  const now = new Date().toISOString();
  for (const result of parsed.data.commandResults) {
    const patch: {
      status: "accepted" | "rejected" | "expired" | "completed";
      reject_reason?: string | null;
      accepted_at?: string;
      completed_at?: string;
    } = { status: result.status };
    if (result.status === "accepted") patch.accepted_at = now;
    if (result.status === "completed" || result.status === "rejected" || result.status === "expired") {
      patch.completed_at = now;
    }
    if (result.rejectReason) patch.reject_reason = result.rejectReason;

    // Idempotent: only transition from pending (or accepted → completed).
    if (result.status === "completed" || result.status === "rejected" || result.status === "expired") {
      await auth.admin
        .from("performance_commands")
        .update(patch)
        .eq("id", result.id)
        .eq("device_id", auth.device.id)
        .in("status", ["pending", "accepted"]);
    } else {
      await auth.admin
        .from("performance_commands")
        .update(patch)
        .eq("id", result.id)
        .eq("device_id", auth.device.id)
        .eq("status", "pending");
    }
  }

  return NextResponse.json({ ok: true });
}
