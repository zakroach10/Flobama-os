"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import type { PublicSupabaseEnv } from "@/lib/env";
import type {
  ServerStationPlaylistCard,
  ServerStationSceneCard,
} from "@/lib/server-station/scenes";
import type { ServerStationWallStatus } from "@/lib/server-station/wall-status-shared";

export type StationSession = {
  actorName: string;
  venueId: string;
  wall: ServerStationWallStatus;
  supabaseEnv: PublicSupabaseEnv | null;
  scenes: ServerStationSceneCard[];
  artistScenes: ServerStationSceneCard[];
  houseScenes: ServerStationSceneCard[];
  playlists: ServerStationPlaylistCard[];
  defaultPlaylistId: string | null;
};

const STATION_HREFS = [
  "/server",
  "/server/events",
  "/server/wall",
  "/server/performances",
  "/server/specials",
  "/server/birthday",
  "/server/message",
  "/server/upload",
  "/server/active",
];

type StationNavValue = {
  session: StationSession;
  path: string;
  go: (href: string) => void;
};

const StationNavContext = createContext<StationNavValue | null>(null);

export function StationProvider({
  session,
  children,
}: {
  session: StationSession;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [path, setPath] = useState(pathname);

  useEffect(() => {
    function onPop() {
      setPath(window.location.pathname);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    for (const href of STATION_HREFS) router.prefetch(href);
  }, [router]);

  function go(href: string) {
    if (href === path) return;
    setPath(href);
    router.push(href);
  }

  return <StationNavContext.Provider value={{ session, path, go }}>{children}</StationNavContext.Provider>;
}

export function useStationNav() {
  return useContext(StationNavContext);
}

export function StationLink({
  href,
  className,
  children,
  ariaCurrent,
  ariaLabel,
  onNavigate,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
  ariaCurrent?: "page" | undefined;
  ariaLabel?: string;
  onNavigate?: () => void;
}) {
  const nav = useStationNav();
  return (
    <Link
      href={href}
      prefetch
      aria-current={ariaCurrent}
      aria-label={ariaLabel}
      className={className}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        onNavigate?.();
        if (nav) nav.go(href);
      }}
    >
      {children}
    </Link>
  );
}
