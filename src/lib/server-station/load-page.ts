import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerStationGate } from "@/lib/server-station/context";
import { listServerStationEvents } from "@/lib/server-station/events";
import { listServerApprovedScenes } from "@/lib/server-station/scenes";
import { getServerStationSettings } from "@/lib/server-station/settings";
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

/** One load for the kiosk shell. Child menus must not repeat this on every tap. */
export async function loadServerStationShell() {
  const gate = await getServerStationGate("access");
  if (!gate.ok) {
    const jar = await cookies();
    const staffCookie = jar.get(SERVER_STATION_STAFF_COOKIE)?.value;
    const staffSession = verifyServerStationStaffCookie(staffCookie);
    if (!staffSession.ok) redirect(SERVER_STATION_LOGIN_PATH);
    redirect(`${SERVER_STATION_LOGIN_PATH}?reason=denied`);
  }

  const [wall, approved, settingsRes, eventsRes] = await Promise.all([
    getServerStationWallStatus(gate.writeClient, gate.venueId),
    listServerApprovedScenes(gate.writeClient, gate.venueId),
    getServerStationSettings(gate.writeClient, gate.venueId),
    // Warm the Events menu + tonight header before the first tap.
    listServerStationEvents(gate.writeClient, gate.venueId, {
      bucket: "upcoming",
      timeZone: gate.timeZone,
    }),
  ]);
  return {
    gate,
    wall,
    approved,
    events: eventsRes.events,
    eventsError: eventsRes.error,
    menusEnabled: settingsRes.settings.menus_enabled,
    supabaseEnv: getPublicSupabaseEnv(),
    home: SERVER_STATION_HOME_PATH,
  };
}
