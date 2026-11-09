"use server";

import { revalidatePath } from "next/cache";
import { getStaffContext } from "@/lib/auth/staff";
import { authorizeMcpSettings } from "@/lib/auth/permissions";
import { generateMcpAccessKey, revokeMcpAccessKey } from "@/lib/mcp/access-store";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type McpAccessActionResult = {
  ok: boolean;
  message: string;
  token?: string;
};

async function adminGate() {
  const context = await getStaffContext();
  if (context.status === "unconfigured") return { ok: false as const, message: "Supabase is not configured." };
  if (context.status === "unauthenticated") return { ok: false as const, message: "Sign in required." };
  if (context.status === "denied") return { ok: false as const, message: "You do not have staff access." };
  if (context.status === "error") return { ok: false as const, message: context.message };
  const allowed = authorizeMcpSettings(context.role);
  if (!allowed.allowed) return { ok: false as const, message: allowed.reason };
  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false as const, message: "Set SUPABASE_SERVICE_ROLE_KEY before managing the MCP key." };
  }
  const actor = context.email?.trim() || context.userId;
  return { ok: true as const, context, admin, actor };
}

export async function generateMcpAccessKeyAction(): Promise<McpAccessActionResult> {
  const gate = await adminGate();
  if (!gate.ok) return gate;
  const result = await generateMcpAccessKey(gate.admin, {
    venueId: gate.context.venue.id,
    createdBy: gate.context.userId,
    actor: gate.actor,
    rotate: false,
  });
  if (!result.ok) return result;
  revalidatePath("/settings");
  return { ok: true, message: "MCP key generated. Copy it now. It will not be shown again.", token: result.token };
}

export async function rotateMcpAccessKeyAction(): Promise<McpAccessActionResult> {
  const gate = await adminGate();
  if (!gate.ok) return gate;
  const result = await generateMcpAccessKey(gate.admin, {
    venueId: gate.context.venue.id,
    createdBy: gate.context.userId,
    actor: gate.actor,
    rotate: true,
  });
  if (!result.ok) return result;
  revalidatePath("/settings");
  return {
    ok: true,
    message: "New MCP key generated. The previous key stopped working. Copy this one now.",
    token: result.token,
  };
}

export async function revokeMcpAccessKeyAction(): Promise<McpAccessActionResult> {
  const gate = await adminGate();
  if (!gate.ok) return gate;
  const result = await revokeMcpAccessKey(gate.admin, {
    venueId: gate.context.venue.id,
    actor: gate.actor,
  });
  if (!result.ok) return result;
  revalidatePath("/settings");
  return { ok: true, message: result.message };
}
