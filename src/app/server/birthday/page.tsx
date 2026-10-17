import { ServerStationGraphicBuilder } from "@/components/server-station/graphic-builder";
import { loadServerStationPage } from "@/lib/server-station/load-page";

export default async function ServerStationBirthdayPage() {
  const { gate, wall, supabaseEnv } = await loadServerStationPage();
  return (
    <ServerStationGraphicBuilder
      actorName={gate.actor.displayName}
      wall={wall}
      mode="birthday"
      venueId={gate.venueId}
      supabaseEnv={supabaseEnv}
    />
  );
}
