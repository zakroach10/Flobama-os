import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerStationGate } from "@/lib/server-station/context";
import { getServerStationWallStatus } from "@/lib/server-station/wall-status";
import {
  SERVER_STATION_HOME_PATH,
  SERVER_STATION_LOGIN_PATH,
} from "@/lib/constants";
import { verifyServerStationStaffCookie } from "@/lib/auth/server-station";
import { SERVER_STATION_STAFF_COOKIE } from "@/lib/constants";
import { getPublicSupabaseEnv } from "@/lib/env";

export async function loadServerStationPage() {
  const gate = await getServerStationGate("access");
  if (!gate.ok) {
    const jar = await cookies();
    const staffCookie = jar.get(SERVER_STATION_STAFF_COOKIE)?.value;
    const staffSession = verifyServerStationStaffCookie(staffCookie);
    if (!staffSession.ok) redirect(SERVER_STATION_LOGIN_PATH);
    redirect(`${SERVER_STATION_LOGIN_PATH}?reason=denied`);
  }

  const wall = await getServerStationWallStatus(gate.writeClient, gate.venueId);
  return {
    gate,
    wall,
    supabaseEnv: getPublicSupabaseEnv(),
    home: SERVER_STATION_HOME_PATH,
  };
}
