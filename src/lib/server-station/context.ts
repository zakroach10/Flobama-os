import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  authorizeServerStation,
  authorizeServerStationConfigure,
  authorizeServerStationContent,
  canAccessServerStation,
} from "@/lib/auth/permissions";
import { getStaffContext, type StaffContext } from "@/lib/auth/staff";
import {
  hashServerStationToken,
  isMissingServerStationRelation,
  refreshServerStationStaffCookie,
  verifyServerStationStaffCookie,
} from "@/lib/auth/server-station";
import {
  SERVER_STATION_DEVICE_COOKIE as DEVICE_COOKIE_NAME,
  SERVER_STATION_OPERATORS_SQL,
  SERVER_STATION_SQL,
  SERVER_STATION_STAFF_COOKIE as STAFF_COOKIE_NAME,
  type StaffRole,
} from "@/lib/constants";
import type { Database, Json } from "@/lib/database.types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServerStationSettings } from "@/lib/server-station/settings";

export type ServerStationActor = {
  /** Null for name-and-PIN operators. Their id is not an auth user, so it must not be stored in created_by. */
  userId: string | null;
  displayName: string;
  role: StaffRole;
  deviceId: string | null;
};

export type ServerStationGateOk = {
  ok: true;
  mode: "staff" | "kiosk";
  venueId: string;
  timeZone: string;
  actor: ServerStationActor;
  supabase: SupabaseClient<Database>;
  /** Prefer for privileged kiosk writes that bypass RLS after app-level authz. */
  writeClient: SupabaseClient<Database>;
  staffContext: Extract<StaffContext, { status: "ok" }> | null;
};

export type ServerStationGateFail = {
  ok: false;
  message: string;
  missingTable?: boolean;
};

async function touchDevice(client: SupabaseClient<Database>, deviceId: string) {
  await client
    .from("server_station_devices")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", deviceId);
}

export async function resolveServerStationDevice() {
  const jar = await cookies();
  const token = jar.get(DEVICE_COOKIE_NAME)?.value;
  if (!token) return null;
  const admin = createServiceRoleClient();
  if (!admin) return null;
  const tokenHash = hashServerStationToken(token);
  const { data, error } = await admin
    .from("server_station_devices")
    .select("id, venue_id, label, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error || !data || data.revoked_at) return null;
  await touchDevice(admin, data.id);
  return data;
}

export async function getServerStationGate(
  mode: "access" | "content" | "configure" = "access",
): Promise<ServerStationGateOk | ServerStationGateFail> {
  const staff = await getStaffContext();
  if (staff.status === "ok" && canAccessServerStation(staff.role)) {
    const allowed =
      mode === "configure"
        ? authorizeServerStationConfigure(staff.role)
        : mode === "content"
          ? authorizeServerStationContent(staff.role)
          : authorizeServerStation(staff.role);
    if (!allowed.allowed) return { ok: false, message: allowed.reason };
    const supabase = await createServerSupabaseClient();
    if (!supabase) return { ok: false, message: "Supabase is not configured." };
    return {
      ok: true,
      mode: "staff",
      venueId: staff.venue.id,
      timeZone: staff.venue.timezone,
      actor: {
        userId: staff.userId,
        displayName: staff.profile?.display_name || staff.email || "Staff",
        role: staff.role,
        deviceId: null,
      },
      supabase,
      writeClient: supabase,
      staffContext: staff,
    };
  }

  const device = await resolveServerStationDevice();
  if (!device) {
    if (staff.status === "unauthenticated") {
      return { ok: false, message: "Sign in or pair this Server Station kiosk." };
    }
    if (staff.status === "ok") {
      return { ok: false, message: "Your role cannot open Server Station." };
    }
    return { ok: false, message: "Pair this kiosk or sign in with a Server Station account." };
  }

  const jar = await cookies();
  const staffToken = jar.get(STAFF_COOKIE_NAME)?.value;
  const verified = verifyServerStationStaffCookie(staffToken);
  if (!verified.ok) return { ok: false, message: verified.message };

  if (verified.session.venueId !== device.venue_id) {
    return { ok: false, message: "Staff session does not match this kiosk." };
  }

  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, message: "Server Station is not configured." };

  let role: StaffRole;
  let actorUserId: string | null = verified.session.userId;
  let displayName = verified.session.displayName;

  if (verified.session.operatorId) {
    const { data: operator, error: operatorError } = await admin
      .from("server_station_operators")
      .select("id, display_name, archived_at")
      .eq("id", verified.session.operatorId)
      .eq("venue_id", device.venue_id)
      .maybeSingle();
    if (operatorError) {
      return {
        ok: false,
        message: isMissingServerStationRelation(operatorError.message)
          ? `Apply ${SERVER_STATION_OPERATORS_SQL} in Supabase, then try again.`
          : operatorError.message,
        missingTable: isMissingServerStationRelation(operatorError.message),
      };
    }
    if (!operator || operator.archived_at) {
      return { ok: false, message: "That kiosk login is no longer active." };
    }
    role = "server";
    actorUserId = null;
    displayName = operator.display_name;
  } else {
    const { data: membership, error: membershipError } = await admin
      .from("venue_memberships")
      .select("role")
      .eq("venue_id", device.venue_id)
      .eq("user_id", verified.session.userId)
      .maybeSingle();

    if (membershipError) {
      return {
        ok: false,
        message: isMissingServerStationRelation(membershipError.message)
          ? `Apply ${SERVER_STATION_SQL} in Supabase, then try again.`
          : membershipError.message,
        missingTable: isMissingServerStationRelation(membershipError.message),
      };
    }
    if (!membership || !canAccessServerStation(membership.role)) {
      return { ok: false, message: "That staff PIN is not allowed on Server Station." };
    }
    role = membership.role;
  }

  const allowed =
    mode === "configure"
      ? authorizeServerStationConfigure(role)
      : mode === "content"
        ? authorizeServerStationContent(role)
        : authorizeServerStation(role);
  if (!allowed.allowed) return { ok: false, message: allowed.reason };

  const { settings } = await getServerStationSettings(admin, device.venue_id);
  // Refresh idle cookie when allowed (Server Actions / Route Handlers).
  // During RSC page render Next.js seals cookies as read-only — swallow that
  // and let proxy.ts extend the cookie on /server navigations instead.
  const refreshed = refreshServerStationStaffCookie(
    {
      ...verified.session,
      deviceId: device.id,
    },
    settings.staff_idle_seconds,
  );
  if (refreshed) {
    try {
      jar.set(STAFF_COOKIE_NAME, refreshed, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: settings.staff_idle_seconds,
        secure: process.env.NODE_ENV === "production",
      });
    } catch {
      // Server Component render — cookie write is not allowed here.
    }
  }

  const { data: venue } = await admin.from("venues").select("timezone").eq("id", device.venue_id).maybeSingle();

  return {
    ok: true,
    mode: "kiosk",
    venueId: device.venue_id,
    timeZone: venue?.timezone || "America/Chicago",
    actor: {
      userId: actorUserId,
      displayName,
      role,
      deviceId: device.id,
    },
    supabase: admin,
    writeClient: admin,
    staffContext: null,
  };
}

export async function writeServerStationAudit(
  client: SupabaseClient<Database>,
  input: {
    venueId: string;
    actor: ServerStationActor;
    action: string;
    detail?: Json;
  },
) {
  const { error } = await client.from("server_station_audit_log").insert({
    venue_id: input.venueId,
    actor_user_id: input.actor.userId,
    actor_name: input.actor.displayName,
    device_id: input.actor.deviceId,
    action: input.action,
    detail: input.detail ?? {},
  });
  if (error && !isMissingServerStationRelation(error.message)) {
    console.error("server station audit failed", error.message);
  }
}

export { DEVICE_COOKIE_NAME as SERVER_STATION_DEVICE_COOKIE_NAME, STAFF_COOKIE_NAME as SERVER_STATION_STAFF_COOKIE_NAME };
