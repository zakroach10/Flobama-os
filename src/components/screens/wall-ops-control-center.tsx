"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronDownIcon,
  CircleIcon,
  LogOutIcon,
  RefreshCwIcon,
  SettingsIcon,
  WifiIcon,
  WifiOffIcon,
} from "lucide-react";
import { activateDefaultAdRollAction, activateArtistLedAction } from "@/actions/artist-led";
import { activateLedWallSceneAction } from "@/actions/led-wall";
import { activateLedPlaylistAction } from "@/actions/led-playlists";
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
      <CircleIcon className="size-2.5 fill-current" aria-hidden />
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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [station, setStation] = useState<WallOpsStation>(readWallOpsStation);
  const [, startTransition] = useTransition();
  const { linkState, lastSyncedAt, stale } = useWallOpsSync({ venueId, supabaseEnv });

  const houseScenes = useMemo(
    () => houseLedScenes(scenes).filter((scene) => scene.enabled),
    [scenes],
  );
  const defaultPlaylist = playlists.find((playlist) => playlist.id === defaultPlaylistId) ?? null;
  const activeScene = scenes.find((scene) => scene.id === activeSceneId) ?? null;
  const activePlaylist = playlists.find((playlist) => playlist.id === activePlaylistId) ?? null;
  const nowPlaying = activePlaylist?.name ?? activeScene?.title ?? "Nothing selected";
  const agentOnline = Boolean(agent.lastSeenAt) && !isAgentStale(agent.lastSeenAt);
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
    <section className="flex min-h-0 flex-col gap-4 rounded-2xl border border-border/70 bg-card/75 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-5">
      <div>
        <h2 className="text-sm font-semibold tracking-[0.16em] text-muted-foreground uppercase">LED Wall</h2>
        <p className="text-sm text-muted-foreground">Primary controls for the house system.</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          size="lg"
          className="min-h-16 text-base"
          disabled={controlsDisabled || !defaultPlaylistId}
          onClick={() => run("ad-roll", () => activateDefaultAdRollAction())}
        >
          {pendingKey === "ad-roll"
            ? "Starting…"
            : activePlaylistId && activePlaylistId === defaultPlaylistId
              ? "House Ads live"
              : "Run House Ads"}
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="min-h-16 text-base text-foreground"
          disabled={controlsDisabled || refreshMissing}
          onClick={() =>
            run("refresh", () => refreshWallDisplaysAction(), {
              confirm: "Refresh all venue screens? Displays will reload.",
            })
          }
        >
          <RefreshCwIcon className="mr-2 size-4" aria-hidden />
          {pendingKey === "refresh" ? "Refreshing…" : "Refresh Wall"}
        </Button>
      </div>

      {defaultPlaylist ? (
        <p className="text-xs text-muted-foreground">
          House ads playlist: <span className="text-foreground">{defaultPlaylist.name}</span>
          {activePlaylistId === defaultPlaylistId ? " · active" : ""}
        </p>
      ) : (
        <p className="text-xs text-amber-400">No default house-ads playlist is configured yet.</p>
      )}

      <div className="space-y-2">
        <h3 className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">Band Screens</h3>
        {todayArtists.length === 0 && artistConfigs.filter((config) => config.enabled).length === 0 ? (
          <p className="text-sm text-muted-foreground">No artist LED graphics ready for today.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
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
                    "flex min-h-18 items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/80 bg-background/50 text-foreground hover:bg-muted/50 disabled:opacity-45",
                  )}
                >
                  <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
                    {artist.publicUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={artist.publicUrl} alt="" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-base font-semibold text-inherit">{artist.name}</span>
                    <span
                      className={cn(
                        "block truncate text-xs",
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
        <div className="space-y-2">
          <h3 className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">Playlists</h3>
          <div className="flex flex-wrap gap-2">
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
                    "min-h-12 rounded-xl border px-4 text-sm font-semibold transition-colors",
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

      <div className="space-y-2">
        <h3 className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">House Scenes</h3>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
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
                  "min-h-24 rounded-xl border px-4 py-3 text-left transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/80 bg-background/50 text-foreground hover:border-primary/40 hover:bg-muted/50",
                )}
              >
                <span className="block text-base font-semibold text-inherit">{scene.title}</span>
                <span className={cn("mt-1 block text-sm", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
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
    </section>
  );

  const uploadSection = (
    <WallOpsSceneUpload venueId={venueId} supabaseEnv={supabaseEnv} disabled={controlsDisabled} />
  );

  return (
    <div className="flex min-h-[calc(100dvh-1.5rem)] flex-col gap-4 text-foreground">
      <header className="rounded-2xl border border-border/70 bg-card/80 p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <FlobamaLogo className="h-8 w-auto max-w-[160px] brightness-110" priority />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Wall & Screens</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Active: <span className="font-medium text-foreground">{nowPlaying}</span>
                {stale ? " · showing last known state" : null}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="space-y-1 text-right">
              <StatusDot tone={linkTone} label={linkLabel} />
              <p className="text-[11px] text-muted-foreground">
                {lastSyncedAt
                  ? `Synced ${new Date(lastSyncedAt).toLocaleTimeString()}`
                  : "Waiting for first sync"}
              </p>
            </div>
            <div className="relative">
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
                  className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-lg"
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
        </div>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-border/60 pt-3">
          <StatusDot
            tone={agentOnline ? (agent.obsConnected ? "ok" : "warn") : "bad"}
            label={
              agentOnline
                ? agent.obsConnected
                  ? "LED agent online"
                  : "LED agent online · OBS down"
                : agent.lastSeenAt
                  ? "LED agent offline"
                  : "LED agent unknown"
            }
          />
          <StatusDot
            tone={linkState === "offline" ? "bad" : "ok"}
            label={linkState === "offline" ? "Internet offline" : "Internet ok"}
          />
          {pendingKey ? <StatusDot tone="warn" label={`Sending: ${pendingKey}`} /> : null}
          {lastCommandError ? <StatusDot tone="bad" label="Last command failed" /> : null}
        </div>
      </header>

      {linkState === "offline" ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          <WifiOffIcon className="size-4 shrink-0" aria-hidden />
          Offline — controls that need the server are disabled. Last known display state may be stale.
        </div>
      ) : linkState === "reconnecting" ? (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <WifiIcon className="size-4 shrink-0" aria-hidden />
          Reconnecting — refreshing shared screen state…
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(18rem,1fr)]">
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

      <section className="rounded-2xl border border-border/70 bg-card/70 p-4 sm:p-5">
        <h2 className="text-sm font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          Status & Diagnostics
        </h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">LED wall agent</dt>
            <dd className="text-sm text-foreground">{describeAgentLink(agent)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Current wall source</dt>
            <dd className="text-sm text-foreground">
              {activePlaylist ? `Playlist · ${activePlaylist.name}` : activeScene ? `Scene · ${activeScene.title}` : "None"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Last wall refresh</dt>
            <dd className="text-sm text-foreground">
              {lastRefreshAt ? new Date(lastRefreshAt).toLocaleString() : "Not requested yet"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Pending command</dt>
            <dd className="text-sm text-foreground">{pendingKey ?? "None"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Last command failure</dt>
            <dd className="text-sm text-foreground">{lastCommandError ?? "None"}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Connected status is only shown when a recent booth heartbeat exists. Command acceptance from the
          server is separate from OBS or display confirmation.
        </p>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/60">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left sm:px-5"
          aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen((open) => !open)}
        >
          <span>
            <span className="block text-sm font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              Advanced
            </span>
            <span className="text-sm text-muted-foreground">Install tips, station notes, and low-frequency tools.</span>
          </span>
          <ChevronDownIcon className={cn("size-5 transition-transform", advancedOpen && "rotate-180")} aria-hidden />
        </button>
        {advancedOpen ? (
          <div className="space-y-4 border-t border-border/60 px-4 py-4 sm:px-5">
            <WallOpsInstallCard />
            <p className="text-sm text-muted-foreground">
              Sound Booth prioritizes LED controls; Back Office prioritizes Upload. Preferences stay on this
              computer only and do not change permissions.
            </p>
            <Button
              type="button"
              variant="outline"
              className="text-foreground"
              disabled={controlsDisabled}
              onClick={() => router.refresh()}
            >
              Force refresh dashboard
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
