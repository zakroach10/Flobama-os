import { ServerStationEventsExplorer } from "@/components/server-station/events-explorer";
import { loadServerStationPage } from "@/lib/server-station/load-page";

export default async function ServerStationEventsPage() {
  const { gate, wall } = await loadServerStationPage();
  return <ServerStationEventsExplorer actorName={gate.actor.displayName} wall={wall} />;
}
