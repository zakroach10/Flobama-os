import { ServerStationDashboard } from "@/components/server-station/dashboard";
import { loadServerStationPage } from "@/lib/server-station/load-page";

export default async function ServerStationHomePage() {
  const { gate, wall } = await loadServerStationPage();
  return <ServerStationDashboard actorName={gate.actor.displayName} wall={wall} />;
}
