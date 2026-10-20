"use client";

import { useEffect } from "react";
import { ServerStationActiveItems } from "@/components/server-station/active-items";
import { ServerStationDashboard } from "@/components/server-station/dashboard";
import { ServerStationEventsExplorer } from "@/components/server-station/events-explorer";
import { ServerStationGraphicBuilder } from "@/components/server-station/graphic-builder";
import { ServerStationPerformances } from "@/components/server-station/performances";
import { ServerStationPhoneUploadPanel } from "@/components/server-station/phone-upload-panel";
import { useStationNav } from "@/components/server-station/station-nav";
import { ServerStationWallControls } from "@/components/server-station/wall-controls";
import { ServerStationYoutubeWall } from "@/components/server-station/youtube-wall";
import {
  isServerStationMenuEnabled,
  menuKeyForServerStationPath,
} from "@/lib/server-station/features";

function DisabledMenuNotice({ title }: { title: string }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-black/25 p-6 text-[#e8d5c4]">
      <h1 className="text-2xl font-bold text-[#f7efe6]">{title}</h1>
      <p className="mt-2 text-base">
        An admin turned this menu off in FloBama OS Settings → Server Station.
      </p>
    </div>
  );
}

export function StationScreen() {
  const nav = useStationNav();
  if (!nav) return null;
  const { session, path, go } = nav;
  const menus = session.menusEnabled;
  const menuKey = menuKeyForServerStationPath(path);

  useEffect(() => {
    if (menuKey && !isServerStationMenuEnabled(menus, menuKey)) {
      go("/server");
    }
  }, [go, menuKey, menus, path]);

  if (menuKey && !isServerStationMenuEnabled(menus, menuKey)) {
    return <DisabledMenuNotice title="Menu unavailable" />;
  }

  if (path.startsWith("/server/youtube")) {
    return <ServerStationYoutubeWall actorName={session.actorName} wall={session.wall} />;
  }
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
  if (path.startsWith("/server/performances")) {
    return <ServerStationPerformances actorName={session.actorName} wall={session.wall} />;
  }
  if (path.startsWith("/server/active")) {
    return <ServerStationActiveItems actorName={session.actorName} wall={session.wall} />;
  }
  return (
    <ServerStationDashboard
      actorName={session.actorName}
      wall={session.wall}
      menusEnabled={session.menusEnabled}
    />
  );
}
