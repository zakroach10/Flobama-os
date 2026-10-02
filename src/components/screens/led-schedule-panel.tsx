"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  activateArtistLedAction,
  activateDefaultAdRollAction,
  setDefaultAdRollPlaylistAction,
} from "@/actions/artist-led";
import { ARTIST_LED_WALL_SQL } from "@/lib/constants";
import type { ArtistLedConfig, TodayLedListing } from "@/lib/queries/artist-led";
import { ARTIST_LED_AUTO_ROLL_MINUTES } from "@/lib/screens/artist-led";
import type { StaffLedPlaylist } from "@/lib/screens/led-playlists";
import { formatVenueDateTime } from "@/lib/timezone";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function LedSchedulePanel({
  listings,
  artistConfigs,
  playlists,
  defaultPlaylistId,
  activeSceneId,
  activePlaylistId,
  missingColumn,
  canConfigure,
  timeZone,
}: {
  listings: TodayLedListing[];
  artistConfigs: ArtistLedConfig[];
  playlists: StaffLedPlaylist[];
  defaultPlaylistId: string | null;
  activeSceneId: string | null;
  activePlaylistId: string | null;
  missingColumn: boolean;
  canConfigure: boolean;
  timeZone: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pickArtistId, setPickArtistId] = useState("");
  const [defaultId, setDefaultId] = useState(defaultPlaylistId ?? "");

  const activeConfigs = useMemo(
    () => artistConfigs.filter((config) => config.enabled),
    [artistConfigs],
  );
  const defaultPlaylist = playlists.find((playlist) => playlist.id === defaultPlaylistId) ?? null;

  if (missingColumn) {
    return (
      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Today on the LED wall</h2>
        <p className="text-sm text-muted-foreground">
          Apply <code className="text-xs">{ARTIST_LED_WALL_SQL}</code> in the Supabase SQL editor for today’s
          artist schedule, ad-roll default, and automatic showtime rolls.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Ad roll (default program)</h2>
            <p className="text-sm text-muted-foreground">
              Everyday from 4:00 AM the wall resets to this playlist (catch-up until 11:00 AM if a tick is
              missed). Artists auto-roll {ARTIST_LED_AUTO_ROLL_MINUTES} minutes before showtime.
            </p>
          </div>
          <Button
            type="button"
            disabled={pending || !defaultPlaylistId}
            onClick={() => {
              startTransition(async () => {
                const result = await activateDefaultAdRollAction();
                if (!result.ok) toast.error(result.message);
                else {
                  toast.success(result.message);
                  router.refresh();
                }
              });
            }}
          >
            {activePlaylistId && activePlaylistId === defaultPlaylistId ? "Ad roll live" : "Play ad roll now"}
          </Button>
        </div>
        {canConfigure ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-56 flex-1 space-y-2">
              <Label htmlFor="default-ad-roll">Default ad-roll playlist</Label>
              <select
                id="default-ad-roll"
                className="h-11 min-h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
                value={defaultId}
                onChange={(event) => setDefaultId(event.target.value)}
              >
                <option value="">Not set</option>
                {playlists.map((playlist) => (
                  <option key={playlist.id} value={playlist.id}>
                    {playlist.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={pending || defaultId === (defaultPlaylistId ?? "")}
              onClick={() => {
                startTransition(async () => {
                  const result = await setDefaultAdRollPlaylistAction({
                    playlistId: defaultId ? defaultId : null,
                  });
                  if (!result.ok) toast.error(result.message);
                  else {
                    toast.success(result.message);
                    router.refresh();
                  }
                });
              }}
            >
              Save default
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {defaultPlaylist
              ? `Default: ${defaultPlaylist.name}`
              : "No default ad-roll playlist is set yet (admin)."}
          </p>
        )}
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div>
          <h2 className="text-lg font-semibold">Today’s schedule</h2>
          <p className="text-sm text-muted-foreground">
            Shows already on the calendar for today. Artists with an active LED graphic can be put on the wall
            here — logos live on the artist profile, not in this list.
          </p>
        </div>
        {listings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No shows listed for today.</p>
        ) : (
          <ul className="space-y-3">
            {listings.map((listing) => (
              <li key={listing.eventId} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">
                      <Link href={`/programming/${listing.eventId}`} className="hover:underline">
                        {listing.title}
                      </Link>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatVenueDateTime(listing.startsAt, timeZone)}
                      {listing.artistNames.length > 0 ? ` · ${listing.artistNames.join(", ")}` : ""}
                    </p>
                  </div>
                </div>
                <ul className="mt-3 space-y-2">
                  {listing.artists.length === 0 ? (
                    <li className="text-sm text-muted-foreground">No artists linked.</li>
                  ) : (
                    listing.artists.map((artist) => (
                      <li
                        key={`${listing.eventId}-${artist.artistId}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex size-10 items-center justify-center overflow-hidden rounded-md bg-white">
                            {artist.publicUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={artist.publicUrl} alt="" className="max-h-full max-w-full object-contain" />
                            ) : (
                              <span className="text-[10px] text-muted-foreground">—</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{artist.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {artist.enabled
                                ? `Auto ${ARTIST_LED_AUTO_ROLL_MINUTES} min before showtime`
                                : "No active LED graphic — set one on the artist profile"}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          disabled={pending || !artist.sceneId || artist.sceneId === activeSceneId}
                          onClick={() => {
                            startTransition(async () => {
                              const result = await activateArtistLedAction({
                                artistId: artist.artistId,
                                eventId: listing.eventId,
                              });
                              if (!result.ok) toast.error(result.message);
                              else {
                                toast.success(result.message);
                                router.refresh();
                              }
                            });
                          }}
                        >
                          {artist.sceneId === activeSceneId ? "On wall" : "Put on wall"}
                        </Button>
                      </li>
                    ))
                  )}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div>
          <h2 className="text-lg font-semibold">Add from active artists</h2>
          <p className="text-sm text-muted-foreground">
            Artists with an active LED configuration who may not be on today’s list.
          </p>
        </div>
        {activeConfigs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active artist LED graphics yet. Upload one from an{" "}
            <Link href="/artists" className="underline-offset-4 hover:underline">
              artist profile
            </Link>
            .
          </p>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-56 flex-1 space-y-2">
              <Label htmlFor="active-artist-led">Artist</Label>
              <select
                id="active-artist-led"
                className="h-11 min-h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
                value={pickArtistId}
                onChange={(event) => setPickArtistId(event.target.value)}
              >
                <option value="">Select an artist</option>
                {activeConfigs.map((config) => (
                  <option key={config.artistId} value={config.artistId}>
                    {config.artistName}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              disabled={pending || !pickArtistId}
              onClick={() => {
                startTransition(async () => {
                  const result = await activateArtistLedAction({ artistId: pickArtistId });
                  if (!result.ok) toast.error(result.message);
                  else {
                    toast.success(result.message);
                    router.refresh();
                  }
                });
              }}
            >
              Put on wall
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
