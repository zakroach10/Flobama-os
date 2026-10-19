import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateDisplayDevice, readBearerToken } from "@/lib/display-devices/agent-auth";
import type { Json } from "@/lib/database.types";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  commandResults: z
    .array(
      z.object({
        id: z.string().uuid(),
        // Runner historically uses completed/rejected/expired; map carefully — never treat accepted as confirmed.
        status: z.enum([
          "accepted",
          "acknowledged",
          "completed",
          "confirmed",
          "rejected",
          "failed",
          "expired",
          "uncertain",
        ]),
        rejectReason: z.string().trim().max(300).nullable().optional(),
        result: z.record(z.string(), z.any()).optional().nullable(),
      }),
    )
    .max(100),
});

function mapAckStatus(
  status: z.infer<typeof bodySchema>["commandResults"][number]["status"],
): "acknowledged" | "confirmed" | "rejected" | "failed" | "expired" | "uncertain" | "sent" {
  switch (status) {
    case "confirmed":
      return "confirmed";
    case "completed":
    case "acknowledged":
      // Runner "completed" means the call returned Done — not confirmed via observable state.
      return "acknowledged";
    case "accepted":
      // Accepted ≠ confirmed. Treat as sent/in-flight acknowledgment only.
      return "sent";
    case "rejected":
      return "rejected";
    case "failed":
      return "failed";
    case "expired":
      return "expired";
    case "uncertain":
      return "uncertain";
    default:
      return "uncertain";
  }
}

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
    const mapped = mapAckStatus(result.status);
    const patch: {
      status: typeof mapped;
      reject_reason?: string | null;
      acknowledged_at?: string;
      completed_at?: string;
      result?: Json | null;
    } = { status: mapped };

    if (mapped === "acknowledged" || mapped === "confirmed" || mapped === "sent") {
      patch.acknowledged_at = now;
    }
    if (
      mapped === "acknowledged" ||
      mapped === "confirmed" ||
      mapped === "rejected" ||
      mapped === "failed" ||
      mapped === "expired" ||
      mapped === "uncertain"
    ) {
      patch.completed_at = now;
    }
    if (result.rejectReason) patch.reject_reason = result.rejectReason;
    if (result.result) patch.result = result.result as Json;

    const openStatuses = ["pending", "queued", "sent", "acknowledged"] as const;
    await auth.admin
      .from("production_commands")
      .update(patch)
      .eq("id", result.id)
      .eq("device_id", auth.device.id)
      .in("status", [...openStatuses]);
  }

  return NextResponse.json({ ok: true });
}
