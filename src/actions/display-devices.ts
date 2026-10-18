"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStaffContext } from "@/lib/auth/staff";
import { authorizeDisplaySafeRefresh, authorizeLedWallConfigure } from "@/lib/auth/permissions";
import { describeLedRunnerLink, freshestLedRunner, type LedRunnerLink } from "@/lib/display-devices/types";
import { listStaffDisplayDevices } from "@/lib/queries/display-devices";
import { getLedWallAgentStatus } from "@/lib/queries/led-wall";
import { isAgentStale } from "@/lib/screens/led-wall";
import {
  createDisplayPairingCode,
  hashDisplaySecret,
  normalizeDisplayPairingCode,
} from "@/lib/display-devices/crypto";
import { isMissingDisplayDeviceRelation } from "@/lib/display-devices/status";
import { DISPLAY_PAIRING_TTL_MS } from "@/lib/display-devices/types";
import { DISPLAY_DEVICES_SQL } from "@/lib/constants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  createDisplayPairingCodeSchema,
  requestDisplaySafeRefreshSchema,
  revokeDisplayDeviceSchema,
} from "@/lib/validation/schemas";

export type DisplayDeviceActionResult = {
  ok: boolean;
  message: string;
  pairingCode?: string;
  expiresAt?: string;
};

function fieldMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Check the highlighted fields.";
}

function displaySqlMessage(message: string) {
  if (isMissingDisplayDeviceRelation(message)) {
    return `Apply ${DISPLAY_DEVICES_SQL} in the Supabase SQL editor, then try again.`;
  }
  return message;
}

async function staffGate(mode: "configure" | "refresh" = "configure") {
  const context = await getStaffContext();
  if (context.status === "unconfigured") return { ok: false as const, message: "Supabase is not configured." };
  if (context.status === "unauthenticated") return { ok: false as const, message: "Sign in required." };
  if (context.status === "denied") return { ok: false as const, message: "You do not have staff access." };
  if (context.status === "error") return { ok: false as const, message: context.message };
  const allowed =
    mode === "refresh"
      ? authorizeDisplaySafeRefresh(context.role, context.email, {
          userId: context.userId,
          wallOpsUserId: context.venue.wall_ops_user_id,
        })
      : authorizeLedWallConfigure(context.role);
  if (!allowed.allowed) return { ok: false as const, message: allowed.reason };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { ok: false as const, message: "Supabase is not configured." };
  return { ok: true as const, context, supabase };
}

function revalidateScreens() {
  revalidatePath("/screens");
  revalidatePath("/dashboard");
}

export async function getLedRunnerLinkAction(): Promise<LedRunnerLink | null> {
  const context = await getStaffContext();
  if (context.status !== "ok") return null;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const [devicesRes, agentRes] = await Promise.all([
    listStaffDisplayDevices(supabase, context.venue.id),
    getLedWallAgentStatus(supabase, context.venue.id),
  ]);
  return describeLedRunnerLink(freshestLedRunner(devicesRes.devices), {
    fresh: Boolean(agentRes.agent.lastSeenAt) && !isAgentStale(agentRes.agent.lastSeenAt),
    programScene: agentRes.agent.programScene,
  });
}

export async function createDisplayPairingCodeAction(input: unknown): Promise<DisplayDeviceActionResult> {
  const gate = await staffGate();
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = createDisplayPairingCodeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  const code = createDisplayPairingCode();
  const expiresAt = new Date(Date.now() + DISPLAY_PAIRING_TTL_MS).toISOString();
  const { error } = await gate.supabase.from("display_device_pairing_codes").insert({
    venue_id: gate.context.venue.id,
    code_hash: hashDisplaySecret(normalizeDisplayPairingCode(code)),
    intended_kind: parsed.data.kind,
    expires_at: expiresAt,
    created_by: gate.context.userId,
  });
  if (error) return { ok: false, message: displaySqlMessage(error.message) };

  revalidateScreens();
  return {
    ok: true,
    pairingCode: code,
    expiresAt,
    message:
      parsed.data.kind === "led_runner"
        ? "Pairing code created. Enter it on the Mac Local Runner within 10 minutes."
        : "Pairing code created. Enter it on the Vertical Player within 10 minutes.",
  };
}

export async function revokeDisplayDeviceAction(input: unknown): Promise<DisplayDeviceActionResult> {
  const gate = await staffGate();
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = revokeDisplayDeviceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, message: "Set SUPABASE_SERVICE_ROLE_KEY before revoking a device." };
  }

  const now = new Date().toISOString();
  const { data: device, error: findError } = await admin
    .from("display_devices")
    .select("id, venue_id, revoked_at")
    .eq("id", parsed.data.deviceId)
    .eq("venue_id", gate.context.venue.id)
    .maybeSingle();
  if (findError) return { ok: false, message: displaySqlMessage(findError.message) };
  if (!device) return { ok: false, message: "Device was not found." };
  if (device.revoked_at) return { ok: true, message: "Device was already revoked." };

  const { error } = await admin
    .from("display_devices")
    .update({ revoked_at: now })
    .eq("id", device.id)
    .eq("venue_id", gate.context.venue.id);
  if (error) return { ok: false, message: displaySqlMessage(error.message) };

  revalidateScreens();
  return { ok: true, message: "Device revoked. It can no longer download media or sync." };
}

export async function requestDisplaySafeRefreshAction(input: unknown): Promise<DisplayDeviceActionResult> {
  const gate = await staffGate("refresh");
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = requestDisplaySafeRefreshSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, message: "Set SUPABASE_SERVICE_ROLE_KEY before requesting a refresh." };
  }

  const { data: device, error: findError } = await admin
    .from("display_devices")
    .select("id, revoked_at")
    .eq("id", parsed.data.deviceId)
    .eq("venue_id", gate.context.venue.id)
    .maybeSingle();
  if (findError) return { ok: false, message: displaySqlMessage(findError.message) };
  if (!device || device.revoked_at) return { ok: false, message: "Device was not found." };

  const { error } = await admin.from("display_device_status").upsert(
    {
      device_id: device.id,
      venue_id: gate.context.venue.id,
      safe_refresh_requested_at: new Date().toISOString(),
      reported_at: new Date().toISOString(),
    },
    { onConflict: "device_id" },
  );
  if (error) return { ok: false, message: displaySqlMessage(error.message) };

  revalidateScreens();
  return { ok: true, message: "Safe refresh requested. The device will pick it up on the next heartbeat." };
}
