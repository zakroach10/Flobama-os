import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ServerStationLoginClient } from "@/components/server-station/login-client";
import {
  hashServerStationToken,
  verifyServerStationStaffCookie,
} from "@/lib/auth/server-station";
import { getStaffContext } from "@/lib/auth/staff";
import { canAccessServerStation } from "@/lib/auth/permissions";
import {
  SERVER_STATION_DEVICE_COOKIE,
  SERVER_STATION_HOME_PATH,
  SERVER_STATION_STAFF_COOKIE,
} from "@/lib/constants";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { FLO_BAMA_VENUE_ID } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function ServerStationLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const params = await searchParams;
  const jar = await cookies();
  const staffCookie = jar.get(SERVER_STATION_STAFF_COOKIE)?.value;
  const staffSession = verifyServerStationStaffCookie(staffCookie);
  if (staffSession.ok) {
    redirect(SERVER_STATION_HOME_PATH);
  }

  const staff = await getStaffContext();
  if (staff.status === "ok" && canAccessServerStation(staff.role) && staff.role !== "server") {
    // Managers/admins can jump straight in with their existing session.
    redirect(SERVER_STATION_HOME_PATH);
  }

  const deviceToken = jar.get(SERVER_STATION_DEVICE_COOKIE)?.value;
  let paired = false;
  let venueId = FLO_BAMA_VENUE_ID;
  const admin = createServiceRoleClient();

  if (deviceToken && admin) {
    const { data: device } = await admin
      .from("server_station_devices")
      .select("id, venue_id, revoked_at")
      .eq("token_hash", hashServerStationToken(deviceToken))
      .maybeSingle();
    if (device && !device.revoked_at) {
      paired = true;
      venueId = device.venue_id;
    }
  }

  const people: Array<{ id: string; displayName: string; kind: "staff" | "operator" }> = [];
  if (admin) {
    const { data: pins } = await admin
      .from("server_station_pins")
      .select("user_id")
      .eq("venue_id", venueId);
    const userIds = (pins ?? []).map((row) => row.user_id);
    if (userIds.length) {
      const { data: memberships } = await admin
        .from("venue_memberships")
        .select("user_id, role")
        .eq("venue_id", venueId)
        .in("user_id", userIds);
      const allowed = new Set(
        (memberships ?? [])
          .filter((row) => canAccessServerStation(row.role))
          .map((row) => row.user_id),
      );
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, display_name")
        .in("id", [...allowed]);
      for (const profile of profiles ?? []) {
        people.push({
          id: profile.id,
          displayName: profile.display_name || "Server",
          kind: "staff",
        });
      }
    }

    const { data: operators, error: operatorError } = await admin
      .from("server_station_operators")
      .select("id, display_name")
      .eq("venue_id", venueId)
      .is("archived_at", null);
    if (!operatorError) {
      for (const operator of operators ?? []) {
        people.push({
          id: operator.id,
          displayName: operator.display_name,
          kind: "operator",
        });
      }
    }
    people.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  return (
    <ServerStationLoginClient paired={paired} people={people} reason={params.reason} />
  );
}
