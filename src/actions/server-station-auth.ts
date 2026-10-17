"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStaffContext } from "@/lib/auth/staff";
import {
  authorizeServerStationConfigure,
  canAccessServerStation,
} from "@/lib/auth/permissions";
import {
  canSignServerStationCookies,
  createServerStationDeviceToken,
  createServerStationPairingCode,
  createServerStationPinSalt,
  hashServerStationPin,
  hashServerStationToken,
  issueServerStationStaffCookie,
  normalizeServerStationPairingCode,
  pinLockUntil,
  SERVER_STATION_HOME_PATH,
  SERVER_STATION_SQL,
  verifyServerStationPin,
} from "@/lib/auth/server-station";
import {
  SERVER_STATION_DEVICE_COOKIE,
  SERVER_STATION_STAFF_COOKIE,
  SERVER_STATION_PIN_MAX_ATTEMPTS,
} from "@/lib/constants";
import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServerStationSettings } from "@/lib/server-station/settings";
import { isMissingServerStationRelation } from "@/lib/auth/server-station";

export type ServerStationAuthResult = {
  ok: boolean;
  message: string;
  code?: string;
  token?: string;
  redirectTo?: string;
};

function sqlMessage(message: string) {
  if (isMissingServerStationRelation(message)) {
    return `Apply ${SERVER_STATION_SQL} in the Supabase SQL editor, then try again.`;
  }
  return message;
}

async function adminGate() {
  const context = await getStaffContext();
  if (context.status !== "ok") return { ok: false as const, message: "Sign in required." };
  const allowed = authorizeServerStationConfigure(context.role);
  if (!allowed.allowed) return { ok: false as const, message: allowed.reason };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { ok: false as const, message: "Supabase is not configured." };
  return { ok: true as const, context, supabase };
}

export async function createServerStationPairingCodeAction(input?: {
  label?: string;
}): Promise<ServerStationAuthResult> {
  const gate = await adminGate();
  if (!gate.ok) return { ok: false, message: gate.message };

  const label = (input?.label?.trim() || "Server Station").slice(0, 80);
  const code = createServerStationPairingCode();
  const codeHash = hashServerStationToken(normalizeServerStationPairingCode(code));
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();

  const { error } = await gate.supabase.from("server_station_pairing_codes").insert({
    venue_id: gate.context.venue.id,
    code_hash: codeHash,
    label,
    expires_at: expiresAt,
    created_by: gate.context.userId,
  });
  if (error) return { ok: false, message: sqlMessage(error.message) };

  revalidatePath("/settings");
  return {
    ok: true,
    message: "Pairing code ready. Enter it on the Server Station kiosk within 10 minutes.",
    code,
  };
}

export async function claimServerStationPairingCodeAction(input: unknown): Promise<ServerStationAuthResult> {
  const parsed = z
    .object({
      code: z.string().trim().min(4).max(16),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Enter the pairing code from Settings." };
  if (!canSignServerStationCookies()) {
    return { ok: false, message: "Server Station cookies are not configured on this server." };
  }

  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, message: "Server Station is not configured." };

  const codeHash = hashServerStationToken(normalizeServerStationPairingCode(parsed.data.code));
  const { data: row, error } = await admin
    .from("server_station_pairing_codes")
    .select("id, venue_id, label, expires_at, consumed_at")
    .eq("code_hash", codeHash)
    .maybeSingle();

  if (error) return { ok: false, message: sqlMessage(error.message) };
  if (!row || row.consumed_at) return { ok: false, message: "That pairing code is not valid." };
  if (Date.parse(row.expires_at) <= Date.now()) {
    return { ok: false, message: "That pairing code expired. Ask an admin for a new one." };
  }

  const token = createServerStationDeviceToken();
  const tokenHash = hashServerStationToken(token);
  const { data: device, error: deviceError } = await admin
    .from("server_station_devices")
    .insert({
      venue_id: row.venue_id,
      label: row.label,
      token_hash: tokenHash,
      last_seen_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (deviceError) return { ok: false, message: sqlMessage(deviceError.message) };

  await admin
    .from("server_station_pairing_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", row.id);

  const jar = await cookies();
  jar.set(SERVER_STATION_DEVICE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 400 * 24 * 60 * 60,
    secure: process.env.NODE_ENV === "production",
  });

  return {
    ok: true,
    message: "This kiosk is paired. Staff can unlock with their PIN.",
    redirectTo: SERVER_STATION_HOME_PATH,
    token: device.id,
  };
}

export async function revokeServerStationDeviceAction(input: unknown): Promise<ServerStationAuthResult> {
  const gate = await adminGate();
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = z.object({ deviceId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Choose a kiosk to revoke." };

  const { error } = await gate.supabase
    .from("server_station_devices")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", parsed.data.deviceId)
    .eq("venue_id", gate.context.venue.id);
  if (error) return { ok: false, message: sqlMessage(error.message) };
  revalidatePath("/settings");
  return { ok: true, message: "Kiosk access revoked." };
}

export async function setServerStationPinAction(input: unknown): Promise<ServerStationAuthResult> {
  const gate = await adminGate();
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = z
    .object({
      userId: z.string().uuid(),
      pin: z.string().regex(/^\d{4,6}$/, "PIN must be 4–6 digits."),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid PIN." };

  const { data: membership } = await gate.supabase
    .from("venue_memberships")
    .select("role")
    .eq("venue_id", gate.context.venue.id)
    .eq("user_id", parsed.data.userId)
    .maybeSingle();
  if (!membership || !canAccessServerStation(membership.role)) {
    return { ok: false, message: "PINs are only for Admin, Manager, or Server accounts." };
  }

  const salt = createServerStationPinSalt();
  const pinHash = hashServerStationPin(parsed.data.pin, salt);
  const { error } = await gate.supabase.from("server_station_pins").upsert(
    {
      venue_id: gate.context.venue.id,
      user_id: parsed.data.userId,
      pin_hash: pinHash,
      pin_salt: salt,
      failed_attempts: 0,
      locked_until: null,
      updated_by: gate.context.userId,
    },
    { onConflict: "venue_id,user_id" },
  );
  if (error) return { ok: false, message: sqlMessage(error.message) };
  revalidatePath("/settings");
  return { ok: true, message: "PIN saved." };
}

export async function clearServerStationPinAction(input: unknown): Promise<ServerStationAuthResult> {
  const gate = await adminGate();
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = z.object({ userId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Choose a staff member." };

  const { error } = await gate.supabase
    .from("server_station_pins")
    .delete()
    .eq("venue_id", gate.context.venue.id)
    .eq("user_id", parsed.data.userId);
  if (error) return { ok: false, message: sqlMessage(error.message) };
  revalidatePath("/settings");
  return { ok: true, message: "PIN cleared." };
}

export async function verifyServerStationPinAction(input: unknown): Promise<ServerStationAuthResult> {
  const parsed = z
    .object({
      userId: z.string().uuid(),
      pin: z.string().regex(/^\d{4,6}$/, "PIN must be 4–6 digits."),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Enter your 4–6 digit PIN." };

  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, message: "Server Station is not configured." };

  const jar = await cookies();
  const deviceToken = jar.get(SERVER_STATION_DEVICE_COOKIE)?.value;
  let venueId = FLO_BAMA_VENUE_ID;
  let deviceId: string | null = null;

  if (deviceToken) {
    const { data: device } = await admin
      .from("server_station_devices")
      .select("id, venue_id, revoked_at")
      .eq("token_hash", hashServerStationToken(deviceToken))
      .maybeSingle();
    if (device && !device.revoked_at) {
      venueId = device.venue_id;
      deviceId = device.id;
    }
  } else {
    // Allow PIN unlock for staff already signed in (shared tablet without device cookie).
    const staff = await getStaffContext();
    if (staff.status === "ok" && canAccessServerStation(staff.role)) {
      venueId = staff.venue.id;
    } else {
      return { ok: false, message: "Pair this kiosk first, or sign in with a Server Station account." };
    }
  }

  const { data: pinRow, error } = await admin
    .from("server_station_pins")
    .select("pin_hash, pin_salt, failed_attempts, locked_until")
    .eq("venue_id", venueId)
    .eq("user_id", parsed.data.userId)
    .maybeSingle();
  if (error) return { ok: false, message: sqlMessage(error.message) };
  if (!pinRow) return { ok: false, message: "No PIN is set for that person. Ask an admin." };

  if (pinRow.locked_until && Date.parse(pinRow.locked_until) > Date.now()) {
    return { ok: false, message: "Too many tries. Wait a minute, then try again." };
  }

  const { data: membership } = await admin
    .from("venue_memberships")
    .select("role")
    .eq("venue_id", venueId)
    .eq("user_id", parsed.data.userId)
    .maybeSingle();
  if (!membership || !canAccessServerStation(membership.role)) {
    return { ok: false, message: "That person cannot use Server Station." };
  }

  const ok = verifyServerStationPin(parsed.data.pin, pinRow.pin_salt, pinRow.pin_hash);
  if (!ok) {
    const failed = (pinRow.failed_attempts ?? 0) + 1;
    await admin
      .from("server_station_pins")
      .update({
        failed_attempts: failed,
        locked_until: pinLockUntil(failed),
      })
      .eq("venue_id", venueId)
      .eq("user_id", parsed.data.userId);
    const left = Math.max(0, SERVER_STATION_PIN_MAX_ATTEMPTS - failed);
    return {
      ok: false,
      message: left
        ? `Incorrect PIN. ${left} tries left.`
        : "Too many incorrect PINs. Wait a minute, then try again.",
    };
  }

  await admin
    .from("server_station_pins")
    .update({ failed_attempts: 0, locked_until: null })
    .eq("venue_id", venueId)
    .eq("user_id", parsed.data.userId);

  const { data: profile } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", parsed.data.userId)
    .maybeSingle();

  const { settings } = await getServerStationSettings(admin, venueId);
  const cookie = issueServerStationStaffCookie(
    {
      venueId,
      userId: parsed.data.userId,
      deviceId,
      displayName: profile?.display_name || "Server",
    },
    settings.staff_idle_seconds,
  );
  if (!cookie) return { ok: false, message: "Could not start the staff session." };

  jar.set(SERVER_STATION_STAFF_COOKIE, cookie, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: settings.staff_idle_seconds,
    secure: process.env.NODE_ENV === "production",
  });

  return {
    ok: true,
    message: `Welcome, ${profile?.display_name || "server"}.`,
    redirectTo: SERVER_STATION_HOME_PATH,
  };
}

export async function lockServerStationStaffAction(): Promise<ServerStationAuthResult> {
  const jar = await cookies();
  jar.delete(SERVER_STATION_STAFF_COOKIE);
  return { ok: true, message: "Locked. Enter a PIN to continue." };
}

/** Extends the kiosk staff PIN cookie. Safe to call from the client while browsing. */
export async function refreshServerStationStaffSessionAction(): Promise<ServerStationAuthResult> {
  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, message: "Server Station is not configured." };

  const jar = await cookies();
  const deviceToken = jar.get(SERVER_STATION_DEVICE_COOKIE)?.value;
  const staffToken = jar.get(SERVER_STATION_STAFF_COOKIE)?.value;
  if (!deviceToken || !staffToken) return { ok: false, message: "Staff session expired." };

  const { data: device } = await admin
    .from("server_station_devices")
    .select("id, venue_id, revoked_at")
    .eq("token_hash", hashServerStationToken(deviceToken))
    .maybeSingle();
  if (!device || device.revoked_at) return { ok: false, message: "This kiosk is not paired." };

  const { verifyServerStationStaffCookie, issueServerStationStaffCookie } = await import(
    "@/lib/auth/server-station"
  );
  const verified = verifyServerStationStaffCookie(staffToken);
  if (!verified.ok) return { ok: false, message: verified.message };
  if (verified.session.venueId !== device.venue_id) {
    return { ok: false, message: "Staff session does not match this kiosk." };
  }

  const { getServerStationSettings } = await import("@/lib/server-station/settings");
  const { settings } = await getServerStationSettings(admin, device.venue_id);
  const cookie = issueServerStationStaffCookie(
    {
      venueId: verified.session.venueId,
      userId: verified.session.userId,
      deviceId: device.id,
      displayName: verified.session.displayName,
    },
    settings.staff_idle_seconds,
  );
  if (!cookie) return { ok: false, message: "Could not refresh the staff session." };

  jar.set(SERVER_STATION_STAFF_COOKIE, cookie, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: settings.staff_idle_seconds,
    secure: process.env.NODE_ENV === "production",
  });
  return { ok: true, message: "Session refreshed." };
}
