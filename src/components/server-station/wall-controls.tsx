"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { toast } from "sonner";
import { activateServerStationSceneAction } from "@/actions/server-station";
import { ServerStationButton, ServerStationShell } from "@/components/server-station/shell";
import {
  paginateServerStationScenes,
  SERVER_STATION_SCENE_PAGE_SIZE,
  type ServerStationPlaylistCard,
  type ServerStationSceneCard,
} from "@/lib/server-station/scenes";
import type { ServerStationWallStatus } from "@/lib/server-station/wall-status-shared";
import { cn } from "@/lib/utils";

function ScenePreview({ scene }: { scene: ServerStationSceneCard }) {
  const url = scene.preview_url;
  const [status, setStatus] = useState<"loading" | "ready" | "error">(url ? "loading" : "error");

  useEffect(() => {
    setStatus(url ? "loading" : "error");
  }, [url, scene.id]);

  if (url && scene.media_kind === "video") {
    return (
      <div className="relative h-full w-full bg-black">
        {status === "loading" ? (
          <div className="absolute inset-0 animate-pulse bg-white/5" aria-hidden />
        ) : null}
        <video
          key={url}
          src={url}
          muted
          playsInline
          preload="metadata"
          className={cn(
            "absolute inset-0 h-full w-full object-contain transition-opacity duration-150",
            status === "ready" ? "opacity-100" : "opacity-0",
          )}
          onLoadedData={() => setStatus("ready")}
          onError={() => setStatus("error")}
        />
        {status === "error" ? (
          <div className="absolute inset-0 flex items-center justify-center px-2 text-center text-xs text-[#e8d5c4]">
            Preview unavailable
          </div>
        ) : null}
      </div>
    );
  }

  if (url) {
    return (
      <div className="relative h-full w-full bg-black">
        {status === "loading" ? (
          <div className="absolute inset-0 animate-pulse bg-white/5" aria-hidden />
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={url}
          src={url}
          alt=""
          className={cn(
            "absolute inset-0 h-full w-full object-contain p-1 transition-opacity duration-150",
            status === "ready" ? "opacity-100" : "opacity-0",
          )}
          loading="eager"
          decoding="async"
          fetchPriority="high"
          onLoad={() => setStatus("ready")}
          onError={() => setStatus("error")}
        />
        {status === "error" ? (
          <div className="absolute inset-0 flex items-center justify-center px-2 text-center text-xs text-[#e8d5c4]">
            Preview unavailable
          </div>
        ) : null}
      </div>
    );
  }

  if (scene.kind === "obs") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 bg-black px-2 text-center text-[#e8d5c4]">
        <span className="text-[10px] font-semibold tracking-[0.16em] uppercase opacity-70">OBS</span>
        <span className="line-clamp-3 text-xs font-medium sm:text-sm">{scene.obs_scene_name || scene.title}</span>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center bg-black text-sm text-[#e8d5c4]">No preview</div>
  );
}

function prefetchScenePreviews(scenes: ServerStationSceneCard[]) {
  if (typeof window === "undefined") return;
  for (const scene of scenes) {
    if (!scene.preview_url || scene.media_kind === "video") continue;
    const img = new window.Image();
    img.decoding = "async";
    img.src = scene.preview_url;
  }
}

export function ServerStationWallControls({
  actorName,
  wall,
  initialScenes,
  initialArtistScenes,
  initialHouseScenes,
  initialPlaylists,
  initialDefaultPlaylistId,
}: {
  actorName: string;
  wall: ServerStationWallStatus;
  initialScenes: ServerStationSceneCard[];
  initialArtistScenes: ServerStationSceneCard[];
  initialHouseScenes: ServerStationSceneCard[];
  initialPlaylists: ServerStationPlaylistCard[];
  initialDefaultPlaylistId: string | null;
}) {
  const catalog = useMemo(() => {
    const house =
      initialHouseScenes.length > 0
        ? initialHouseScenes
        : initialScenes.filter((scene) => !scene.artist_id);
    const artists =
      initialArtistScenes.length > 0
        ? initialArtistScenes
        : initialScenes.filter((scene) => Boolean(scene.artist_id));
    return [...house, ...artists];
  }, [initialArtistScenes, initialHouseScenes, initialScenes]);

  const [playlists] = useState(initialPlaylists);
  const [defaultPlaylistId] = useState(initialDefaultPlaylistId);
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<{ label: string; payload: Record<string, unknown> } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const paged = useMemo(
    () => paginateServerStationScenes(catalog, page, SERVER_STATION_SCENE_PAGE_SIZE),
    [catalog, page],
  );

  useEffect(() => {
    if (page !== paged.page) setPage(paged.page);
  }, [page, paged.page]);

  // Current page must load immediately; next page warms in the background.
  useEffect(() => {
    prefetchScenePreviews(paged.items);
    if (!paged.hasNext) return;
    const next = paginateServerStationScenes(catalog, paged.page + 1, SERVER_STATION_SCENE_PAGE_SIZE);
    prefetchScenePreviews(next.items);
  }, [catalog, paged.hasNext, paged.items, paged.page]);

  function run(payload: Record<string, unknown>) {
    startTransition(async () => {
      const result = await activateServerStationSceneAction(payload);
      setConfirm(null);
      setMessage(result.message);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  const extraPlaylists = playlists
    .filter((playlist) => playlist.id !== defaultPlaylistId)
    .slice(0, 2);

  return (
    <ServerStationShell actorName={actorName} wall={wall} title="LED Wall Controls" layout="pos">
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <p className="mr-auto hidden text-sm text-[#e8d5c4]/80 lg:block">
            {catalog.length} scenes · {SERVER_STATION_SCENE_PAGE_SIZE} per page
          </p>
          <button
            type="button"
            disabled={pending || !defaultPlaylistId}
            onClick={() =>
              setConfirm({
                label: "House Ads / normal rotation",
                payload: { resumeNormal: true },
              })
            }
            className="min-h-12 rounded-2xl border border-[#d36b4a]/50 bg-[#d36b4a]/25 px-4 text-sm font-bold text-[#f7efe6] disabled:opacity-40 sm:min-h-14 sm:px-5 sm:text-base"
          >
            Resume Normal
          </button>
          {defaultPlaylistId ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                setConfirm({
                  label: "House Ads",
                  payload: { playlistId: defaultPlaylistId },
                })
              }
              className="min-h-12 rounded-2xl border border-white/15 bg-black/30 px-4 text-sm font-bold text-[#f7efe6] disabled:opacity-40 sm:min-h-14 sm:px-5 sm:text-base"
            >
              House Ads
            </button>
          ) : null}
          {extraPlaylists.map((playlist) => (
            <button
              key={playlist.id}
              type="button"
              disabled={pending}
              onClick={() =>
                setConfirm({
                  label: playlist.name,
                  payload: { playlistId: playlist.id },
                })
              }
              className="min-h-12 rounded-2xl border border-white/15 bg-black/30 px-4 text-sm font-bold text-[#f7efe6] disabled:opacity-40 sm:min-h-14 sm:px-5 sm:text-base"
            >
              {playlist.name}
            </button>
          ))}
        </div>

        {!wall.connected && wall.offlineReason ? (
          <p className="shrink-0 truncate rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-50">
            {wall.offlineReason}
          </p>
        ) : null}
        {message ? (
          <p className="shrink-0 truncate rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-50">
            {message}
          </p>
        ) : null}

        {catalog.length ? (
          <div className="grid grid-cols-2 gap-2 max-lg:auto-rows-[9.75rem] sm:max-lg:grid-cols-3 lg:min-h-0 lg:flex-1 lg:grid-cols-4 lg:grid-rows-5 lg:gap-2.5 xl:grid-cols-5 xl:grid-rows-4">
            {paged.items.map((scene) => (
              <button
                key={`${paged.page}-${scene.id}`}
                type="button"
                disabled={pending}
                onClick={() =>
                  setConfirm({
                    label: scene.title,
                    payload: { sceneId: scene.id },
                  })
                }
                className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/15 bg-black/35 text-left disabled:opacity-40"
              >
                <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
                  <ScenePreview scene={scene} />
                </div>
                <div className="shrink-0 border-t border-white/10 px-2 py-1.5 sm:px-2.5 sm:py-2">
                  <p className="line-clamp-2 text-xs font-bold leading-tight text-[#f7efe6] sm:text-sm">
                    {scene.title}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-white/10 bg-black/20 p-6 text-center text-[#e8d5c4]">
            No scenes are available yet. Artist graphics appear automatically; ask an admin to approve house
            scenes in Settings → Server Station.
          </div>
        )}

        <div className="flex shrink-0 items-center justify-between gap-3 pt-1">
          <button
            type="button"
            disabled={!paged.hasPrev || pending}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className={cn(
              "inline-flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-bold lg:min-h-14 lg:min-w-[8.5rem] lg:flex-none lg:px-4 lg:text-base",
              paged.hasPrev
                ? "border-white/20 bg-white/10 text-[#f7efe6]"
                : "border-white/5 bg-black/20 text-white/30",
            )}
          >
            <ChevronLeftIcon className="size-5" aria-hidden />
            Prev
          </button>
          <p className="text-center text-sm font-semibold text-[#e8d5c4] sm:text-base">
            Page {paged.page} of {paged.pageCount}
          </p>
          <button
            type="button"
            disabled={!paged.hasNext || pending}
            onClick={() => setPage((current) => current + 1)}
            className={cn(
              "inline-flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-bold lg:min-h-14 lg:min-w-[8.5rem] lg:flex-none lg:px-4 lg:text-base",
              paged.hasNext
                ? "border-white/20 bg-white/10 text-[#f7efe6]"
                : "border-white/5 bg-black/20 text-white/30",
            )}
          >
            Next
            <ChevronRightIcon className="size-5" aria-hidden />
          </button>
        </div>
      </div>

      {confirm ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-[28px] border border-white/15 bg-[#1a1613] p-6">
            <h2 className="text-2xl font-bold text-[#f7efe6]">Switch LED wall to {confirm.label}?</h2>
            <p className="mt-2 text-[#e8d5c4]">This updates the live wall once the command is accepted.</p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <ServerStationButton variant="secondary" onClick={() => setConfirm(null)}>
                Cancel
              </ServerStationButton>
              <ServerStationButton disabled={pending} onClick={() => run(confirm.payload)}>
                Change Wall
              </ServerStationButton>
            </div>
          </div>
        </div>
      ) : null}
    </ServerStationShell>
  );
}
