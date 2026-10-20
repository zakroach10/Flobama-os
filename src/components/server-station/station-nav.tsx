"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { listServerStationEventsAction } from "@/actions/server-station";
import type { PublicSupabaseEnv } from "@/lib/env";
import type {
  ServerStationPlaylistCard,
  ServerStationSceneCard,
} from "@/lib/server-station/scenes";
import type { ServerStationMenusEnabled } from "@/lib/server-station/features";
import { DEFAULT_SERVER_STATION_MENUS_ENABLED } from "@/lib/server-station/features";
import {
  isServerStationEventTonight,
  type ServerStationEventCard,
} from "@/lib/server-station/events";
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
  menusEnabled: ServerStationMenusEnabled;
  /** Preloaded on shell install so Events does not wait on first open. */
  events: ServerStationEventCard[];
  eventsError: string | null;
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
  "/server/youtube",
  "/server/active",
];

/** Soft refresh while the kiosk stays open — not on every Events tap. */
const EVENTS_REFRESH_MS = 5 * 60_000;

export { DEFAULT_SERVER_STATION_MENUS_ENABLED };

type StationNavValue = {
  session: StationSession;
  path: string;
  go: (href: string) => void;
  events: ServerStationEventCard[];
  tonightEvents: ServerStationEventCard[];
  eventsError: string | null;
  eventsPending: boolean;
  refreshEvents: () => Promise<void>;
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
  const pathRef = useRef(path);
  pathRef.current = path;
  const [events, setEvents] = useState(session.events);
  const [eventsError, setEventsError] = useState(session.eventsError);
  const [eventsPending, setEventsPending] = useState(session.events.length === 0);
  const inFlightRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    setEvents(session.events);
    setEventsError(session.eventsError);
    if (session.events.length > 0) setEventsPending(false);
  }, [session.events, session.eventsError]);

  const refreshEvents = useCallback(async () => {
    if (inFlightRef.current) return inFlightRef.current;
    const run = (async () => {
      const result = await listServerStationEventsAction({ bucket: "upcoming" });
      if (result.ok) {
        setEvents(result.events);
        setEventsError(null);
      } else {
        setEventsError(result.message);
      }
      setEventsPending(false);
    })().finally(() => {
      inFlightRef.current = null;
    });
    inFlightRef.current = run;
    return run;
  }, []);

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

  useEffect(() => {
    // If shell install somehow missed events, fetch once right away.
    // Otherwise keep the cache warm on a long interval — never block menu taps.
    let cancelled = false;
    const boot = window.setTimeout(() => {
      if (cancelled) return;
      if (session.events.length === 0) void refreshEvents();
    }, session.events.length === 0 ? 0 : 2_000);
    const timer = window.setInterval(() => {
      if (!cancelled) void refreshEvents();
    }, EVENTS_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(boot);
      window.clearInterval(timer);
    };
  }, [refreshEvents, session.events.length]);

  const go = useCallback(
    (href: string) => {
      if (href === pathRef.current) return;
      setPath(href);
      router.push(href);
    },
    [router],
  );

  const tonightEvents = useMemo(
    () => events.filter((event) => isServerStationEventTonight(event)),
    [events],
  );

  const value = useMemo<StationNavValue>(
    () => ({
      session,
      path,
      go,
      events,
      tonightEvents,
      eventsError,
      eventsPending,
      refreshEvents,
    }),
    [session, path, go, events, tonightEvents, eventsError, eventsPending, refreshEvents],
  );

  return <StationNavContext.Provider value={value}>{children}</StationNavContext.Provider>;
}

export function useStationNav() {
  return useContext(StationNavContext);
}

export function useStationEvents() {
  const nav = useStationNav();
  return {
    events: nav?.events ?? [],
    tonightEvents: nav?.tonightEvents ?? [],
    error: nav?.eventsError ?? null,
    pending: nav?.eventsPending ?? false,
    refresh: nav?.refreshEvents ?? (async () => undefined),
  };
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
