"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { toast } from "sonner";
import { activateServerStationSceneAction } from "@/actions/server-station";
import { ServerStationButton, ServerStationShell } from "@/components/server-station/shell";
import {
  cacheLedPosterUrl,
  LED_SCENE_POSTER_JPEG_QUALITY,
  LED_SCENE_POSTER_MAX_EDGE,
} from "@/lib/screens/led-poster";
import { acquireLoopPreviewSlot } from "@/lib/server-station/preview-load";
import {
  paginateServerStationScenes,
  SERVER_STATION_SCENE_PAGE_SIZE,
  type ServerStationPlaylistCard,
  type ServerStationSceneCard,
} from "@/lib/server-station/scenes";
import type { ServerStationWallStatus } from "@/lib/server-station/wall-status-shared";
import { cn } from "@/lib/utils";

function persistScenePoster(sceneId: string, posterObjectUrl: string) {
  void (async () => {
    try {
      const response = await fetch(posterObjectUrl);
      const blob = await response.blob();
      if (!blob.size || blob.type !== "image/jpeg") return;
      const body = new FormData();
      body.set("sceneId", sceneId);
      body.set("poster", new File([blob], "poster.jpg", { type: "image/jpeg" }));
      await fetch("/api/server-station/scene-poster", { method: "POST", body });
    } catch {
      /* best-effort; tile already shows a frame */
    }
  })();
}

function blobFromVideoFrame(video: HTMLVideoElement): Promise<string | null> {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return Promise.resolve(null);
  const scale = Math.min(1, LED_SCENE_POSTER_MAX_EDGE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  try {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  } catch {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve(null);
          return;
        }
        resolve(URL.createObjectURL(blob));
      },
      "image/jpeg",
      LED_SCENE_POSTER_JPEG_QUALITY,
    );
  });
}

/** Paints a loop frame; persists a JPEG in the background for the next visit. */
function LoopVideoFallback({ url, sceneId }: { url: string; sceneId: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let release: (() => void) | null = null;
    void acquireLoopPreviewSlot().then((rel) => {
      release = rel;
      if (cancelled) {
        rel();
        return;
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
      release?.();
      setReady(false);
    };
  }, [sceneId, url]);

  useEffect(() => {
    if (!ready) return;
    const el = ref.current;
    if (!el) return;
    let cancelled = false;

    const showFrame = () => {
      try {
        const duration = Number.isFinite(el.duration) ? el.duration : 0;
        el.currentTime = duration > 0 ? Math.min(0.05, duration * 0.01) : 0.001;
      } catch {
        /* ignore */
      }
      void el.play().then(
        () => {
          el.pause();
        },
        () => undefined,
      );
    };

    const persistFromElement = () => {
      void blobFromVideoFrame(el).then((poster) => {
        if (cancelled || !poster) return;
        cacheLedPosterUrl(url, poster);
        // Keep the video frame on screen — swapping to a blob can hitch on phones.
        persistScenePoster(sceneId, poster);
      });
    };

    el.addEventListener("loadeddata", showFrame, { once: true });
    el.addEventListener("seeked", persistFromElement, { once: true });
    el.src = `${url}${url.includes("#") ? "" : "#t=0.001"}`;
    el.load();
    return () => {
      cancelled = true;
      el.removeAttribute("src");
      el.load();
    };
  }, [ready, sceneId, url]);

  return (
    <>
      {!ready ? <div className="absolute inset-0 animate-pulse bg-white/5" aria-hidden /> : null}
      <video
        ref={ref}
        muted
        playsInline
        preload={ready ? "metadata" : "none"}
        className="absolute inset-0 h-full w-full object-contain"
      />
    </>
  );
}

function ScenePreview({ scene, priority }: { scene: ServerStationSceneCard; priority: boolean }) {
  const isVideo = scene.media_kind === "video";
  const posterUrl = scene.preview_url;
  const mediaUrl = scene.public_url;
  const [displayUrl, setDisplayUrl] = useState<string | null>(() => posterUrl);
  const [failed, setFailed] = useState(false);
  const [useVideoFallback, setUseVideoFallback] = useState(false);

  useEffect(() => {
    setDisplayUrl(posterUrl);
    setFailed(false);
    setUseVideoFallback(false);
  }, [posterUrl, mediaUrl, scene.id]);

  function beginLoopPreview() {
    if (!isVideo || !mediaUrl || useVideoFallback) return;
    setDisplayUrl(null);
    setUseVideoFallback(true);
    setFailed(false);
  }

  // Loops with no preview endpoint / stored poster yet.
  useEffect(() => {
    if (!isVideo || !mediaUrl || posterUrl || displayUrl || useVideoFallback) return;
    beginLoopPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayUrl, isVideo, mediaUrl, posterUrl, scene.id, useVideoFallback]);

  if (displayUrl) {
    return (
      <div className="relative h-full w-full bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={displayUrl}
          src={displayUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-contain p-1"
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "low"}
          onError={() => {
            if (isVideo && mediaUrl) {
              beginLoopPreview();
              return;
            }
            setFailed(true);
          }}
        />
        {failed ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black px-2 text-center text-xs text-[#e8d5c4]">
            Preview unavailable
          </div>
        ) : null}
      </div>
    );
  }

  if (isVideo && mediaUrl && useVideoFallback) {
    return (
      <div className="relative h-full w-full bg-black">
        <LoopVideoFallback url={mediaUrl} sceneId={scene.id} />
      </div>
    );
  }

  if (isVideo && mediaUrl) {
    return (
      <div className="relative h-full w-full bg-black">
        <div className="absolute inset-0 animate-pulse bg-white/5" aria-hidden />
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
    if (!scene.preview_url) continue;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = scene.preview_url;
    link.setAttribute("data-ss-preview", scene.id);
    if (!document.head.querySelector(`link[data-ss-preview="${scene.id}"]`)) {
      document.head.appendChild(link);
    }
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
            {paged.items.map((scene, index) => (
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
                className="flex h-[9.75rem] w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-white/15 bg-black/35 text-left disabled:opacity-40 lg:h-full lg:min-h-0"
              >
                <div className="relative h-[6.5rem] w-full shrink-0 overflow-hidden bg-black lg:h-auto lg:min-h-0 lg:flex-1">
                  <ScenePreview scene={scene} priority={index < 8} />
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
