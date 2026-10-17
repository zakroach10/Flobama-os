import { ServerStationWallControls } from "@/components/server-station/wall-controls";
import { getServerStationGate } from "@/lib/server-station/context";
import { listServerApprovedScenes } from "@/lib/server-station/scenes";
import { getServerStationWallStatus } from "@/lib/server-station/wall-status";
import {
  SERVER_STATION_LOGIN_PATH,
  SERVER_STATION_STAFF_COOKIE,
} from "@/lib/constants";
import { verifyServerStationStaffCookie } from "@/lib/auth/server-station";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function ServerStationWallPage() {
  const gate = await getServerStationGate("access");
  if (!gate.ok) {
    const jar = await cookies();
    const staffCookie = jar.get(SERVER_STATION_STAFF_COOKIE)?.value;
    const staffSession = verifyServerStationStaffCookie(staffCookie);
    if (!staffSession.ok) redirect(SERVER_STATION_LOGIN_PATH);
    redirect(`${SERVER_STATION_LOGIN_PATH}?reason=denied`);
  }

  const [wall, approved] = await Promise.all([
    getServerStationWallStatus(gate.writeClient, gate.venueId),
    listServerApprovedScenes(gate.writeClient, gate.venueId),
  ]);

  return (
    <ServerStationWallControls
      actorName={gate.actor.displayName}
      wall={wall}
      initialScenes={approved.scenes}
      initialArtistScenes={approved.artistScenes}
      initialHouseScenes={approved.houseScenes}
      initialPlaylists={approved.playlists}
      initialDefaultPlaylistId={approved.defaultPlaylistId}
    />
  );
}
