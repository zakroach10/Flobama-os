"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { activateDefaultAdRollAction, activateArtistLedAction } from "@/actions/artist-led";
import { activateLedWallSceneAction } from "@/actions/led-wall";
import { activateLedPlaylistAction } from "@/actions/led-playlists";
import { clearScreenTakeoverAction, startScreenTakeoverAction } from "@/actions/screens";
import { refreshWallDisplaysAction } from "@/actions/display-signals";
import { Button } from "@/components/ui/button";
import type { ArtistLedConfig, TodayLedListing } from "@/lib/queries/artist-led";
import type { LedWallAgentSnapshot, LedWallSceneRow } from "@/lib/queries/led-wall";
import type { StaffLedPlaylist } from "@/lib/screens/led-playlists";
import type { StaffScreenAd } from "@/lib/screens/playlist";
import type { StaffTakeover } from "@/lib/screens/takeover";
import { houseLedScenes } from "@/lib/screens/artist-led";
import { agentStatusCopy, ledSceneDetail } from "@/lib/screens/led-wall";
import { formatTakeoverUntil, takeoverRemainingLabel } from "@/lib/screens/takeover";
import { formatVenueDateTime } from "@/lib/timezone";
import { SCREEN_TAKEOVER_PRESETS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function WallOpsControlCenter({
  scenes,
  activeSceneId,
  activePlaylistId,
  defaultPlaylistId,
  playlists,
  listings,
  artistConfigs,
  agent,
  ads,
  takeover,
  takeoverMissing,
  refreshMissing,
  lastRefreshAt,
  timeZone,
  canControlVertical,
}: {
  scenes: LedWallSceneRow[];
  activeSceneId: string | null;
  activePlaylistId: string | null;
  defaultPlaylistId: string | null;
  playlists: StaffLedPlaylist[];
  listings: TodayLedListing[];
  artistConfigs: ArtistLedConfig[];
  agent: LedWallAgentSnapshot;
  ads: StaffScreenAd[];
  takeover: StaffTakeover | null;
  takeoverMissing: boolean;
  refreshMissing: boolean;
  lastRefreshAt: string | null;
  timeZone: string;
  canControlVertical: boolean;
}) {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [takeoverAdId, setTakeoverAdId] = useState(takeover?.adId ?? ads[0]?.id ?? "");

  const houseScenes = useMemo(
    () => houseLedScenes(scenes).filter((scene) => scene.enabled),
    [scenes],
  );
  const defaultPlaylist = playlists.find((playlist) => playlist.id === defaultPlaylistId) ?? null;
  const activeScene = scenes.find((scene) => scene.id === activeSceneId) ?? null;
  const activePlaylist = playlists.find((playlist) => playlist.id === activePlaylistId) ?? null;
  const nowPlaying = activePlaylist?.name ?? activeScene?.title ?? "Nothing selected";
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

  function run(key: string, action: () => Promise<{ ok: boolean; message: string }>) {
    setPendingKey(key);
    startTransition(async () => {
      const result = await action();
      setPendingKey(null);
      if (!result.ok) toast.error(result.message);
      else {
        toast.success(result.message);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col gap-3 lg:min-h-[calc(100dvh-3.75rem)]">
      <section className="grid gap-3 rounded-2xl border border-border/80 bg-card/80 p-3 sm:grid-cols-[1fr_auto] sm:items-center sm:p-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-primary uppercase">Now on the wall</p>
          <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{nowPlaying}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{agentStatusCopy(agent)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="lg"
            className="min-h-12 flex-1 sm:flex-none"
            disabled={pendingKey !== null || !defaultPlaylistId}
            onClick={() => run("ad-roll", () => activateDefaultAdRollAction())}
          >
            {pendingKey === "ad-roll"
              ? "Starting…"
              : activePlaylistId && activePlaylistId === defaultPlaylistId
                ? "Ad roll live"
                : "Play ad roll"}
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="min-h-12 flex-1 sm:flex-none"
            disabled={pendingKey !== null || refreshMissing}
            onClick={() => run("refresh", () => refreshWallDisplaysAction())}
          >
            {pendingKey === "refresh" ? "Refreshing…" : "Refresh screens"}
          </Button>
        </div>
        {defaultPlaylist || lastRefreshAt ? (
          <p className="text-xs text-muted-foreground sm:col-span-2">
            {defaultPlaylist ? `Default ad roll: ${defaultPlaylist.name}` : null}
            {defaultPlaylist && lastRefreshAt ? " · " : null}
            {lastRefreshAt ? `Last refresh ${new Date(lastRefreshAt).toLocaleString()}` : null}
          </p>
        ) : null}
      </section>

      <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)]">
        <section className="flex min-h-0 flex-col gap-3 rounded-2xl border border-border/80 bg-card/80 p-3 sm:p-4">
          <div className="flex items-end justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold tracking-[0.16em] text-muted-foreground uppercase">LED wall</h2>
              <p className="text-sm text-muted-foreground">Tap a scene to put it on the wall.</p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {houseScenes.map((scene) => {
              const active = scene.id === activeSceneId && !activePlaylistId;
              const pending = pendingKey === `scene-${scene.id}`;
              return (
                <button
                  key={scene.id}
                  type="button"
                  aria-pressed={active}
                  disabled={pendingKey !== null}
                  onClick={() => run(`scene-${scene.id}`, () => activateLedWallSceneAction({ sceneId: scene.id }))}
                  className={cn(
                    "min-h-24 rounded-xl border px-4 py-3 text-left transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-[0_0_0_1px_var(--primary)]"
                      : "border-border/80 bg-background/60 hover:border-primary/50 hover:bg-muted/60",
                  )}
                >
                  <span className="block text-base font-semibold">{scene.title}</span>
                  <span className={cn("mt-1 block text-sm", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
                    {pending ? "Switching…" : active ? "Live now" : ledSceneDetail(scene)}
                  </span>
                </button>
              );
            })}
            {houseScenes.length === 0 ? (
              <p className="text-sm text-muted-foreground sm:col-span-2">No house scenes are enabled yet.</p>
            ) : null}
          </div>

          {playlists.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">Playlists</h3>
              <div className="flex flex-wrap gap-2">
                {playlists.slice(0, 6).map((playlist) => {
                  const active = playlist.id === activePlaylistId;
                  const pending = pendingKey === `playlist-${playlist.id}`;
                  return (
                    <button
                      key={playlist.id}
                      type="button"
                      disabled={pendingKey !== null}
                      onClick={() =>
                        run(`playlist-${playlist.id}`, () => activateLedPlaylistAction({ playlistId: playlist.id }))
                      }
                      className={cn(
                        "min-h-11 rounded-full border px-4 text-sm font-medium transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/80 bg-background/60 hover:bg-muted/60",
                      )}
                    >
                      {pending ? "Starting…" : playlist.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="min-h-0 flex-1 space-y-2">
            <h3 className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">Today’s artists</h3>
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
                      disabled={pendingKey !== null || !artist.sceneId || !artist.enabled}
                      onClick={() =>
                        run(`artist-${artist.key}`, () =>
                          activateArtistLedAction({ artistId: artist.artistId, eventId: artist.eventId }),
                        )
                      }
                      className={cn(
                        "flex min-h-16 items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/80 bg-background/60 hover:bg-muted/60 disabled:opacity-45",
                      )}
                    >
                      <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
                        {artist.publicUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={artist.publicUrl} alt="" className="max-h-full max-w-full object-contain" />
                        ) : (
                          <span className="text-[10px] text-neutral-500">—</span>
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{artist.name}</span>
                        <span
                          className={cn(
                            "block truncate text-xs",
                            active ? "text-primary-foreground/80" : "text-muted-foreground",
                          )}
                        >
                          {pending
                            ? "Switching…"
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
        </section>

        <section className="flex min-h-0 flex-col gap-3 rounded-2xl border border-border/80 bg-card/80 p-3 sm:p-4">
          <div>
            <h2 className="text-sm font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              Vertical screens
            </h2>
            <p className="text-sm text-muted-foreground">Hold a graphic on the TVs around the room.</p>
          </div>

          {!canControlVertical ? (
            <p className="text-sm text-muted-foreground">This login can control the LED wall only.</p>
          ) : takeoverMissing ? (
            <p className="text-sm text-muted-foreground">Vertical takeover SQL is not applied yet.</p>
          ) : (
            <>
              <div
                className={cn(
                  "rounded-xl border px-3 py-3",
                  takeover ? "border-primary/50 bg-primary/10" : "border-border/80 bg-background/60",
                )}
              >
                {takeover ? (
                  <>
                    <p className="font-medium">{takeover.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {takeoverRemainingLabel(takeover.endsAt)} · {formatTakeoverUntil(takeover.endsAt, timeZone)}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-3 w-full"
                      disabled={pendingKey !== null}
                      onClick={() => run("clear-takeover", () => clearScreenTakeoverAction())}
                    >
                      {pendingKey === "clear-takeover" ? "Clearing…" : "Clear takeover"}
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No takeover active. Playlist is running.</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase" htmlFor="wall-ops-ad">
                  Graphic
                </label>
                <select
                  id="wall-ops-ad"
                  className="h-11 min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  value={takeoverAdId}
                  onChange={(event) => setTakeoverAdId(event.target.value)}
                >
                  <option value="">Choose a graphic</option>
                  {ads.map((ad) => (
                    <option key={ad.id} value={ad.id}>
                      {ad.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {SCREEN_TAKEOVER_PRESETS.filter((minutes) => minutes <= 120).map((minutes) => (
                  <Button
                    key={minutes}
                    type="button"
                    variant="secondary"
                    className="min-h-12"
                    disabled={pendingKey !== null || !takeoverAdId}
                    onClick={() =>
                      run(`takeover-${minutes}`, () =>
                        startScreenTakeoverAction({ adId: takeoverAdId, minutes }),
                      )
                    }
                  >
                    {pendingKey === `takeover-${minutes}` ? "Holding…" : `${minutes} min`}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-12 col-span-2"
                  disabled={pendingKey !== null || !takeoverAdId}
                  onClick={() =>
                    run("takeover-clear", () =>
                      startScreenTakeoverAction({ adId: takeoverAdId, minutes: null }),
                    )
                  }
                >
                  {pendingKey === "takeover-clear" ? "Holding…" : "Hold until cleared"}
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
