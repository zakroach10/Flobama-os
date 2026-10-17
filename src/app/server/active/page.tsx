import { ServerStationActiveItems } from "@/components/server-station/active-items";
import { loadServerStationPage } from "@/lib/server-station/load-page";

export default async function ServerStationActivePage() {
  const { gate, wall } = await loadServerStationPage();
  return <ServerStationActiveItems actorName={gate.actor.displayName} wall={wall} />;
}
