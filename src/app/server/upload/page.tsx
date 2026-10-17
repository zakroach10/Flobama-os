import { ServerStationPhoneUploadPanel } from "@/components/server-station/phone-upload-panel";
import { loadServerStationPage } from "@/lib/server-station/load-page";

export default async function ServerStationUploadPage() {
  const { gate, wall, supabaseEnv } = await loadServerStationPage();
  return (
    <ServerStationPhoneUploadPanel
      actorName={gate.actor.displayName}
      wall={wall}
      venueId={gate.venueId}
      supabaseEnv={supabaseEnv}
    />
  );
}
