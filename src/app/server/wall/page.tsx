import { ServerStationWallControls } from "@/components/server-station/wall-controls";
import { loadServerStationPage } from "@/lib/server-station/load-page";

export default async function ServerStationWallPage() {
  const { gate, wall } = await loadServerStationPage();
  return <ServerStationWallControls actorName={gate.actor.displayName} wall={wall} />;
}
