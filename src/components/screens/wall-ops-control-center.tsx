"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  LogOutIcon,
  RefreshCwIcon,
  SettingsIcon,
  WifiIcon,
  WifiOffIcon,
} from "lucide-react";
import { activateDefaultAdRollAction, activateArtistLedAction } from "@/actions/artist-led";
import { activateLedWallSceneAction } from "@/actions/led-wall";
import { activateLedPlaylistAction } from "@/actions/led-playlists";
import { getLedRunnerLinkAction, requestDisplaySafeRefreshAction } from "@/actions/display-devices";
import { refreshWallDisplaysAction } from "@/actions/display-signals";
import { signOutWallOpsAction } from "@/actions/records";
import { FlobamaLogo } from "@/components/brand/flobama-logo";
import { WallOpsInstallCard } from "@/components/pwa/wall-ops-install-card";
import { WallOpsSceneUpload } from "@/components/screens/wall-ops-scene-upload";
import { Button } from "@/components/ui/button";
import { useWallOpsSync } from "@/hooks/use-wall-ops-sync";
import type { PublicSupabaseEnv } from "@/lib/env";
import type { ArtistLedConfig, TodayLedListing } from "@/lib/queries/artist-led";
import type { LedWallAgentSnapshot, LedWallSceneRow } from "@/lib/queries/led-wall";
import type { StaffLedPlaylist } from "@/lib/screens/led-playlists";
import { houseLedScenes } from "@/lib/screens/artist-led";
import { describeAgentLink, isAgentStale, ledSceneDetail } from "@/lib/screens/led-wall";
import {
  readWallOpsStation,
  WALL_OPS_STATION_LABELS,
  WALL_OPS_STATIONS,
  writeWallOpsStation,
  type WallOpsStation,
} from "@/lib/screens/wall-ops-station";
import { formatVenueDateTime } from "@/lib/timezone";
import { cn } from "@/lib/utils";

function StatusDot({
  tone,
  label,
}: {
  tone: "ok" | "warn" | "bad" | "muted";
  label: string;
}) {
  const color =
    tone === "ok"
      ? "text-emerald-400"
      : tone === "warn"
        ? "text-amber-400"
        : tone === "bad"
          ? "text-red-400"
          : "text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", color)} title={label}>
      <span className="size-2 shrink-0 rounded-full bg-current" aria-hidden />
      {label}
    </span>
  );
}

export function WallOpsControlCenter({
  scenes,
  activeSceneId,
  activePlaylistId,
  defaultPlaylistId,
  playlists,
  listings,
  artistConfigs,
  agent,
  runner,
  refreshMissing,
  lastRefreshAt,
  timeZone,
  venueId,
  supabaseEnv,
}: {
  scenes: LedWallSceneRow[];
  activeSceneId: string | null;
  activePlaylistId: string | null;
  defaultPlaylistId: string | null;
  playlists: StaffLedPlaylist[];
  listings: TodayLedListing[];
  artistConfigs: ArtistLedConfig[];
  agent: LedWallAgentSnapshot;
  runner: { online: boolean; label: string; deviceId: string | null };
  refreshMissing: boolean;
  lastRefreshAt: string | null;
  timeZone: string;
  venueId: string;
  supabaseEnv: PublicSupabaseEnv | null;
}) {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [lastCommandError, setLastCommandError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [station, setStation] = useState<WallOpsStation>(readWallOpsStation);
  const [liveRunner, setLiveRunner] = useState(runner);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setLiveRunner(runner);
  }, [runner]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void getLedRunnerLinkAction().then((next) => {
        if (next) setLiveRunner(next);
      });
    }, 8_000);
    return () => window.clearInterval(timer);
  }, []);
  const { linkState, lastSyncedAt, stale } = useWallOpsSync({ venueId, supabaseEnv });

  const houseScenes = useMemo(
    () => houseLedScenes(scenes).filter((scene) => scene.enabled),
    [scenes],
  );
  const defaultPlaylist = playlists.find((playlist) => playlist.id === defaultPlaylistId) ?? null;
  const activeScene = scenes.find((scene) => scene.id === activeSceneId) ?? null;
  const activePlaylist = playlists.find((playlist) => playlist.id === activePlaylistId) ?? null;
  const nowPlaying = activePlaylist?.name ?? activeScene?.title ?? "Nothing selected";
  const agentOnline = liveRunner.online || (Boolean(agent.lastSeenAt) && !isAgentStale(agent.lastSeenAt));
  const wallLabel = liveRunner.deviceId ? liveRunner.label : agentOnline ? "Booth connected" : "Local runner offline";
  const todayArtists = useMemo(() => {
    const rows: Array<{
      key: string;
      artistId: string;
      name: string;
      eventId: string;
      title: string;
      startsAt: string;
      sceneId: string | null;
      publicUrl: string | null;
      enabled: boolean;
    }> = [];
    for (const listing of listings) {
      for (const artist of listing.artists) {
        rows.push({
          key: `${listing.eventId}-${artist.artistId}`,
          artistId: artist.artistId,
          name: artist.name,
          eventId: listing.eventId,
          title: listing.title,
          startsAt: listing.startsAt,
          sceneId: artist.sceneId,
          publicUrl: artist.publicUrl,
          enabled: artist.enabled,
        });
      }
    }
    return rows;
  }, [listings]);

  const controlsDisabled = pendingKey !== null || linkState === "offline";
  const uploadFirst = station === "back-office";

  function run(key: string, action: () => Promise<{ ok: boolean; message: string }>, opts?: { confirm?: string }) {
    if (opts?.confirm && typeof window !== "undefined" && !window.confirm(opts.confirm)) return;
    if (linkState === "offline") {
      toast.error("You are offline. Reconnect before sending screen commands.");
      return;
    }
    setPendingKey(key);
    setLastCommandError(null);
    startTransition(async () => {
      try {
        const result = await action();
        setPendingKey(null);
        if (!result.ok) {
          setLastCommandError(result.message);
          toast.error(result.message);
        } else {
          toast.success(result.message);
          router.refresh();
        }
      } catch (error) {
        setPendingKey(null);
        const message = error instanceof Error ? error.message : "Command failed.";
        setLastCommandError(message);
        toast.error(message);
      }
    });
  }

  const linkLabel =
    linkState === "offline" ? "Offline" : linkState === "reconnecting" ? "Reconnecting…" : "Connected";
  const linkTone = linkState === "connected" ? "ok" : linkState === "reconnecting" ? "warn" : "bad";

  const ledPrimary = (
    <section className="flex min-h-0 flex-col gap-2 overflow-hidden rounded-xl border border-border/70 bg-card/75 p-3">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">LED Wall</h2>
          <p className="text-xs text-muted-foreground">
            {defaultPlaylist
              ? `House ads: ${defaultPlaylist.name}${activePlaylistId === defaultPlaylistId ? " · live" : ""}`
              : "No default house-ads playlist yet"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            className="min-h-10 px-4"
            disabled={controlsDisabled || !defaultPlaylistId}
            onClick={() => run("ad-roll", () => activateDefaultAdRollAction())}
          >
            {pendingKey === "ad-roll"
              ? "Starting…"
              : activePlaylistId && activePlaylistId === defaultPlaylistId
                ? "Ads live"
                : "Run House Ads"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-10 px-4 text-foreground"
            disabled={controlsDisabled || refreshMissing}
            onClick={() =>
              run("refresh", () => refreshWallDisplaysAction(), {
                confirm: "Refresh all venue screens? Displays will reload.",
              })
            }
          >
            <RefreshCwIcon className="mr-1.5 size-3.5" aria-hidden />
            {pendingKey === "refresh" ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
        <div className="space-y-1.5">
          <h3 className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Band Screens</h3>
          {todayArtists.length === 0 && artistConfigs.filter((config) => config.enabled).length === 0 ? (
            <p className="text-sm text-muted-foreground">No artist LED graphics ready for today.</p>
          ) : (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {todayArtists.map((artist) => {
                const active = Boolean(artist.sceneId && artist.sceneId === activeSceneId && !activePlaylistId);
                const pending = pendingKey === `artist-${artist.key}`;
                return (
                  <button
                    key={artist.key}
                    type="button"
                    disabled={controlsDisabled || !artist.sceneId || !artist.enabled}
                    onClick={() =>
                      run(`artist-${artist.key}`, () =>
                        activateArtistLedAction({ artistId: artist.artistId, eventId: artist.eventId }),
                      )
                    }
                    className={cn(
                      "flex min-h-12 items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/80 bg-background/50 text-foreground hover:bg-muted/50 disabled:opacity-45",
                    )}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white">
                      {artist.publicUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={artist.publicUrl} alt="" className="max-h-full max-w-full object-contain" />
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-inherit">{artist.name}</span>
                      <span
                        className={cn(
                          "block truncate text-[11px]",
                          active ? "text-primary-foreground/80" : "text-muted-foreground",
                        )}
                      >
                        {pending
                          ? "Sending…"
                          : active
                            ? "On the wall"
                            : `${formatVenueDateTime(artist.startsAt, timeZone)} · ${artist.title}`}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {playlists.length > 0 ? (
          <div className="space-y-1.5">
            <h3 className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Playlists</h3>
            <div className="flex flex-wrap gap-1.5">
              {playlists.map((playlist) => {
                const active = playlist.id === activePlaylistId;
                const pending = pendingKey === `playlist-${playlist.id}`;
                return (
                  <button
                    key={playlist.id}
                    type="button"
                    disabled={controlsDisabled}
                    onClick={() =>
                      run(`playlist-${playlist.id}`, () => activateLedPlaylistAction({ playlistId: playlist.id }))
                    }
                    className={cn(
                      "min-h-9 rounded-lg border px-3 text-sm font-semibold transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/80 bg-background/50 text-foreground hover:bg-muted/50",
                    )}
                  >
                    {pending ? "Starting…" : playlist.name}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <h3 className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">House Scenes</h3>
          <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
            {houseScenes.map((scene) => {
              const active = scene.id === activeSceneId && !activePlaylistId;
              const pending = pendingKey === `scene-${scene.id}`;
              return (
                <button
                  key={scene.id}
                  type="button"
                  aria-pressed={active}
                  disabled={controlsDisabled}
                  onClick={() => run(`scene-${scene.id}`, () => activateLedWallSceneAction({ sceneId: scene.id }))}
                  className={cn(
                    "min-h-14 rounded-lg border px-3 py-2 text-left transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/80 bg-background/50 text-foreground hover:border-primary/40 hover:bg-muted/50",
                  )}
                >
                  <span className="block truncate text-sm font-semibold text-inherit">{scene.title}</span>
                  <span
                    className={cn(
                      "mt-0.5 block truncate text-[11px]",
                      active ? "text-primary-foreground/80" : "text-muted-foreground",
                    )}
                  >
                    {pending ? "Sending…" : active ? "Live now" : ledSceneDetail(scene)}
                  </span>
                </button>
              );
            })}
            {houseScenes.length === 0 ? (
              <p className="text-sm text-muted-foreground sm:col-span-2">No house scenes are enabled yet.</p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );

  const uploadSection = (
    <WallOpsSceneUpload venueId={venueId} supabaseEnv={supabaseEnv} disabled={controlsDisabled} compact />
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden text-foreground">
      <header className="shrink-0 rounded-xl border border-border/70 bg-card/80 px-3 py-2.5">
        <div className="flex items-center gap-3">
          <FlobamaLogo className="h-7 w-auto max-w-[120px] shrink-0 brightness-110" priority />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <h1 className="text-lg font-semibold tracking-tight">Wall & Screens</h1>
              <p className="truncate text-sm text-muted-foreground">
                Active: <span className="font-medium text-foreground">{nowPlaying}</span>
                {stale ? " · last known" : null}
              </p>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <StatusDot tone={linkTone} label={linkLabel} />
              <StatusDot tone={agentOnline ? "ok" : "bad"} label={wallLabel} />
              {liveRunner.deviceId ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-foreground"
                  disabled={pendingKey !== null}
                  onClick={() => {
                    const deviceId = liveRunner.deviceId;
                    if (!deviceId) return;
                    setPendingKey("push");
                    startTransition(async () => {
                      const result = await requestDisplaySafeRefreshAction({ deviceId });
                      setPendingKey(null);
                      if (!result.ok) {
                        setLastCommandError(result.message);
                        toast.error(result.message);
                        return;
                      }
                      setLastCommandError(null);
                      toast.success(result.message);
                    });
                  }}
                >
                  {pendingKey === "push" ? "Pushing…" : "Push update"}
                </Button>
              ) : null}
              {lastSyncedAt ? (
                <span className="text-[11px] text-muted-foreground">
                  Synced {new Date(lastSyncedAt).toLocaleTimeString()}
                </span>
              ) : null}
              {pendingKey ? <StatusDot tone="warn" label="Sending…" /> : null}
              {lastCommandError ? <StatusDot tone="bad" label="Command failed" /> : null}
            </div>
          </div>

          <div className="relative shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-foreground"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <SettingsIcon className="mr-1.5 size-4" aria-hidden />
              Settings
            </Button>
            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 z-50 mt-2 max-h-[min(28rem,70dvh)] w-80 overflow-y-auto rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-lg"
              >
                <p className="px-2 py-1 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  Station layout
                </p>
                {WALL_OPS_STATIONS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={station === value}
                    className={cn(
                      "flex w-full rounded-lg px-3 py-2 text-left text-sm",
                      station === value ? "bg-muted font-medium" : "hover:bg-muted/60",
                    )}
                    onClick={() => {
                      setStation(value);
                      writeWallOpsStation(value);
                      setMenuOpen(false);
                    }}
                  >
                    {WALL_OPS_STATION_LABELS[value]}
                  </button>
                ))}

                <div className="my-2 border-t border-border" />
                <p className="px-2 py-1 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  Diagnostics
                </p>
                <div className="space-y-2 px-2 py-1 text-xs text-muted-foreground">
                  <p>
                    <span className="text-foreground">Agent:</span> {describeAgentLink(agent)}
                  </p>
                  <p>
                    <span className="text-foreground">Source:</span>{" "}
                    {activePlaylist
                      ? `Playlist · ${activePlaylist.name}`
                      : activeScene
                        ? `Scene · ${activeScene.title}`
                        : "None"}
                  </p>
                  <p>
                    <span className="text-foreground">Last refresh:</span>{" "}
                    {lastRefreshAt ? new Date(lastRefreshAt).toLocaleString() : "Not requested"}
                  </p>
                  <p>
                    <span className="text-foreground">Last failure:</span> {lastCommandError ?? "None"}
                  </p>
                </div>

                <div className="my-2 border-t border-border" />
                <div className="space-y-2 px-1 py-1">
                  <WallOpsInstallCard />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full text-foreground"
                    disabled={controlsDisabled}
                    onClick={() => {
                      router.refresh();
                      setMenuOpen(false);
                    }}
                  >
                    Force refresh dashboard
                  </Button>
                </div>

                <div className="my-2 border-t border-border" />
                <form action={signOutWallOpsAction}>
                  <button
                    type="submit"
                    role="menuitem"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted/60"
                  >
                    <LogOutIcon className="size-4" aria-hidden />
                    Log out
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        </div>

        {linkState === "offline" ? (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs text-red-100">
            <WifiOffIcon className="size-3.5 shrink-0" aria-hidden />
            Offline — server controls disabled.
          </div>
        ) : linkState === "reconnecting" ? (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-100">
            <WifiIcon className="size-3.5 shrink-0" aria-hidden />
            Reconnecting…
          </div>
        ) : null}
      </header>

      <div className="grid min-h-0 flex-1 gap-2 overflow-hidden xl:grid-cols-[minmax(0,1.65fr)_minmax(17rem,1fr)]">
        {uploadFirst ? (
          <>
            {uploadSection}
            {ledPrimary}
          </>
        ) : (
          <>
            {ledPrimary}
            {uploadSection}
          </>
        )}
      </div>
    </div>
  );
}
