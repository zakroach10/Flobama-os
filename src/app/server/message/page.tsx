import { ServerStationGraphicBuilder } from "@/components/server-station/graphic-builder";
import { loadServerStationPage } from "@/lib/server-station/load-page";

export default async function ServerStationMessagePage() {
  const { gate, wall, supabaseEnv } = await loadServerStationPage();
  return (
    <ServerStationGraphicBuilder
      actorName={gate.actor.displayName}
      wall={wall}
      mode="message"
      venueId={gate.venueId}
      supabaseEnv={supabaseEnv}
    />
  );
}
