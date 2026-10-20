import { StationProvider } from "@/components/server-station/station-nav";
import { StationScreen } from "@/components/server-station/station-screen";
import { loadServerStationShell } from "@/lib/server-station/load-page";

export default async function ServerStationShellLayout({ children }: { children: React.ReactNode }) {
  const loaded = await loadServerStationShell();
  return (
    <StationProvider
      session={{
        actorName: loaded.gate.actor.displayName,
        venueId: loaded.gate.venueId,
        wall: loaded.wall,
        supabaseEnv: loaded.supabaseEnv,
        scenes: loaded.approved.scenes,
        artistScenes: loaded.approved.artistScenes,
        houseScenes: loaded.approved.houseScenes,
        playlists: loaded.approved.playlists,
        defaultPlaylistId: loaded.approved.defaultPlaylistId,
        menusEnabled: loaded.menusEnabled,
        events: loaded.events,
        eventsError: loaded.eventsError,
      }}
    >
      <StationScreen />
      {children}
    </StationProvider>
  );
}
