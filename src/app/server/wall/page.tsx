import { ServerStationWallControls } from "@/components/server-station/wall-controls";
import { loadServerStationPage } from "@/lib/server-station/load-page";
import { listServerApprovedScenes } from "@/lib/server-station/scenes";

export default async function ServerStationWallPage() {
  const { gate, wall } = await loadServerStationPage();
  const approved = await listServerApprovedScenes(gate.writeClient, gate.venueId);
  return (
    <ServerStationWallControls
      actorName={gate.actor.displayName}
      wall={wall}
      initialScenes={approved.scenes}
      initialPlaylists={approved.playlists}
      initialDefaultPlaylistId={approved.defaultPlaylistId}
    />
  );
}
