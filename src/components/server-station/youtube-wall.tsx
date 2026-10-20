"use client";

import { useEffect, useState, useTransition } from "react";
import { HeartIcon, QrCodeIcon, StarIcon } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import {
  issueServerStationUploadSessionAction,
  listServerStationYoutubeLibraryAction,
  playYoutubeOnWallAction,
  pollServerStationUploadSessionAction,
  toggleServerStationYoutubeFavoriteAction,
} from "@/actions/server-station";
import {
  ServerStationButton,
  ServerStationField,
  ServerStationShell,
  serverStationInputClass,
} from "@/components/server-station/shell";
import { parseYoutubeVideoUrl } from "@/lib/screens/youtube";
import type { ServerStationYoutubeVideo } from "@/lib/server-station/youtube-library";
import type { ServerStationWallStatus } from "@/lib/server-station/wall-status-shared";
import { cn } from "@/lib/utils";

function VideoRow({
  video,
  pending,
  onPlay,
  onToggleFavorite,
}: {
  video: ServerStationYoutubeVideo;
  pending: boolean;
  onPlay: (video: ServerStationYoutubeVideo) => void;
  onToggleFavorite: (video: ServerStationYoutubeVideo) => void;
}) {
  return (
    <div className="flex gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={video.thumbnailUrl ?? undefined}
        alt=""
        className="h-16 w-28 shrink-0 rounded-xl object-cover bg-black/40"
      />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="truncate text-sm font-semibold text-[#f7efe6]">{video.title}</p>
        <p className="text-xs text-[#e8d5c4]/80">
          {video.playCount} play{video.playCount === 1 ? "" : "s"}
          {video.isFavorite ? " · favorite" : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          <ServerStationButton
            type="button"
            disabled={pending}
            onClick={() => onPlay(video)}
            className="min-h-11 px-4 text-sm"
          >
            Play
          </ServerStationButton>
          <ServerStationButton
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => onToggleFavorite(video)}
            className="min-h-11 px-4 text-sm"
          >
            {video.isFavorite ? "Unfavorite" : "Favorite"}
          </ServerStationButton>
        </div>
      </div>
    </div>
  );
}

export function ServerStationYoutubeWall({
  actorName,
  wall,
}: {
  actorName: string;
  wall: ServerStationWallStatus;
}) {
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [resultOk, setResultOk] = useState(false);
  const [recent, setRecent] = useState<ServerStationYoutubeVideo[]>([]);
  const [favorites, setFavorites] = useState<ServerStationYoutubeVideo[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [qrHint, setQrHint] = useState<string | null>(null);

  const parsed = parseYoutubeVideoUrl(url);

  function reloadLibrary() {
    startTransition(async () => {
      const result = await listServerStationYoutubeLibraryAction();
      if (!result.ok) {
        if (/Apply /i.test(result.message)) setResultMessage(result.message);
        return;
      }
      setRecent(result.recent);
      setFavorites(result.favorites);
    });
  }

  useEffect(() => {
    reloadLibrary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    const timer = window.setInterval(() => {
      void (async () => {
        const result = await pollServerStationUploadSessionAction({ sessionId });
        if (!result.ok) return;
        if (result.youtubeSubmitted && result.youtubeUrl) {
          setSessionId(null);
          setQrDataUrl(null);
          setQrHint(null);
          setUrl(result.youtubeUrl);
          toast.success("YouTube link received from phone.");
          const playResult = await playYoutubeOnWallAction({
            url: result.youtubeUrl,
            title: result.youtubeTitle ?? undefined,
          });
          setResultOk(playResult.ok);
          setResultMessage(playResult.message);
          if (playResult.ok) {
            toast.success(playResult.message);
            setUrl("");
            reloadLibrary();
          } else {
            toast.error(playResult.message);
          }
        }
      })();
    }, 2000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  function play(nextUrl: string, title?: string) {
    startTransition(async () => {
      setResultMessage(null);
      const result = await playYoutubeOnWallAction({ url: nextUrl, title });
      setResultOk(result.ok);
      setResultMessage(result.message);
      if (result.ok) {
        toast.success(result.message);
        setUrl("");
        reloadLibrary();
      } else {
        toast.error(result.message);
      }
    });
  }

  function createQr() {
    startTransition(async () => {
      const result = await issueServerStationUploadSessionAction({ workflow: "youtube" });
      if (!result.ok || !result.uploadUrl || !result.sessionId) {
        toast.error(result.message);
        setResultOk(false);
        setResultMessage(result.message);
        return;
      }
      const dataUrl = await QRCode.toDataURL(result.uploadUrl, {
        margin: 1,
        width: 280,
        color: { dark: "#100e0c", light: "#f7efe6" },
      });
      setQrDataUrl(dataUrl);
      setSessionId(result.sessionId);
      setQrHint("Guest scans, pastes the YouTube link, then this station plays it.");
      toast.success(result.message);
    });
  }

  function toggleFavorite(video: ServerStationYoutubeVideo) {
    startTransition(async () => {
      const result = await toggleServerStationYoutubeFavoriteAction({
        videoId: video.videoId,
        favorite: !video.isFavorite,
        url: video.watchUrl,
        title: video.title,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      reloadLibrary();
    });
  }

  return (
    <ServerStationShell actorName={actorName} wall={wall} title="YouTube">
      <div className="mb-4 space-y-1 lg:mb-5 lg:space-y-2">
        <h1 className="text-2xl font-bold text-[#f7efe6] lg:text-3xl">YouTube on the wall</h1>
        <p className="text-base text-[#e8d5c4]/90 lg:text-lg">
          Paste a link, or show a QR so a guest can send one from their phone. When the video ends, the
          wall returns to normal programming.
        </p>
      </div>

      <div className="space-y-4 rounded-[28px] border border-white/10 bg-black/25 p-4 lg:p-5">
        <ServerStationField label="YouTube link">
          <input
            className={cn(serverStationInputClass, "font-normal")}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://youtube.com/watch?v=…"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={pending}
          />
        </ServerStationField>

        {parsed ? (
          <p className="text-sm text-[#9ad7ff]">Ready · video {parsed.videoId}</p>
        ) : url.trim() ? (
          <p className="text-sm text-[#ffb4a2]">Need a full YouTube video link (watch, youtu.be, or Shorts).</p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <ServerStationButton
            type="button"
            disabled={pending || !parsed}
            onClick={() => play(url)}
            className="w-full sm:flex-1"
          >
            {pending ? "Sending…" : "Play on wall"}
          </ServerStationButton>
          <ServerStationButton
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={createQr}
            className="w-full sm:flex-1"
          >
            <span className="inline-flex items-center gap-2">
              <QrCodeIcon className="h-5 w-5" />
              Guest QR
            </span>
          </ServerStationButton>
        </div>

        {qrDataUrl ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-black/30 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="YouTube link QR" className="h-56 w-56 rounded-xl" />
            <p className="text-center text-sm text-[#e8d5c4]">{qrHint}</p>
            <ServerStationButton
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setQrDataUrl(null);
                setSessionId(null);
                setQrHint(null);
              }}
              className="min-h-11 px-4 text-sm"
            >
              Close QR
            </ServerStationButton>
          </div>
        ) : null}

        {resultMessage ? (
          <p className={cn("text-base", resultOk ? "text-[#9ad7ff]" : "text-[#ffb4a2]")}>{resultMessage}</p>
        ) : null}
      </div>

      <section className="mt-6 space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-[#f7efe6]">
          <StarIcon className="h-5 w-5 text-[#f0b429]" />
          Favorites
        </h2>
        {favorites.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-[#e8d5c4]">
            No favorites yet. Play a video, then tap Favorite.
          </p>
        ) : (
          <div className="space-y-3">
            {favorites.map((video) => (
              <VideoRow
                key={`fav-${video.id}`}
                video={video}
                pending={pending}
                onPlay={(item) => play(item.watchUrl, item.title)}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 space-y-3 pb-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-[#f7efe6]">
          <HeartIcon className="h-5 w-5 text-[#d36b4a]" />
          Recently played
        </h2>
        {recent.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-[#e8d5c4]">
            Nothing played yet tonight.
          </p>
        ) : (
          <div className="space-y-3">
            {recent.map((video) => (
              <VideoRow
                key={`recent-${video.id}`}
                video={video}
                pending={pending}
                onPlay={(item) => play(item.watchUrl, item.title)}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        )}
      </section>
    </ServerStationShell>
  );
}
