"use client";

import { ServerStationActiveItems } from "@/components/server-station/active-items";
import { ServerStationDashboard } from "@/components/server-station/dashboard";
import { ServerStationEventsExplorer } from "@/components/server-station/events-explorer";
import { ServerStationGraphicBuilder } from "@/components/server-station/graphic-builder";
import { ServerStationPhoneUploadPanel } from "@/components/server-station/phone-upload-panel";
import { useStationNav } from "@/components/server-station/station-nav";
import { ServerStationWallControls } from "@/components/server-station/wall-controls";

export function StationScreen() {
  const nav = useStationNav();
  if (!nav) return null;
  const { session, path } = nav;

  if (path.startsWith("/server/wall")) {
    return (
      <ServerStationWallControls
        actorName={session.actorName}
        wall={session.wall}
        initialScenes={session.scenes}
        initialArtistScenes={session.artistScenes}
        initialHouseScenes={session.houseScenes}
        initialPlaylists={session.playlists}
        initialDefaultPlaylistId={session.defaultPlaylistId}
      />
    );
  }
  if (path.startsWith("/server/specials")) {
    return (
      <ServerStationGraphicBuilder
        actorName={session.actorName}
        wall={session.wall}
        mode="special"
        venueId={session.venueId}
        supabaseEnv={session.supabaseEnv}
      />
    );
  }
  if (path.startsWith("/server/birthday")) {
    return (
      <ServerStationGraphicBuilder
        actorName={session.actorName}
        wall={session.wall}
        mode="birthday"
        venueId={session.venueId}
        supabaseEnv={session.supabaseEnv}
      />
    );
  }
  if (path.startsWith("/server/message")) {
    return (
      <ServerStationGraphicBuilder
        actorName={session.actorName}
        wall={session.wall}
        mode="message"
        venueId={session.venueId}
        supabaseEnv={session.supabaseEnv}
      />
    );
  }
  if (path.startsWith("/server/upload")) {
    return (
      <ServerStationPhoneUploadPanel
        actorName={session.actorName}
        wall={session.wall}
        venueId={session.venueId}
        supabaseEnv={session.supabaseEnv}
      />
    );
  }
  if (path.startsWith("/server/events")) {
    return <ServerStationEventsExplorer actorName={session.actorName} wall={session.wall} />;
  }
  if (path.startsWith("/server/active")) {
    return <ServerStationActiveItems actorName={session.actorName} wall={session.wall} />;
  }
  return <ServerStationDashboard actorName={session.actorName} wall={session.wall} />;
}
