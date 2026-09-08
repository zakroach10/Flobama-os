"use client";

import { useEffect, useRef, useState } from "react";
import { VERTICAL_PLAYLIST_POLL_MS } from "@/lib/constants";
import { containScale, VERTICAL_FRAME_HEIGHT, VERTICAL_FRAME_WIDTH } from "@/lib/screens/frame";
import {
  holdMsForAd,
  isWeekEventsAd,
  nextPlaylistIndex,
  normalizePublicPlaylist,
  playlistRevision,
  playlistsEqual,
  type PublicScreenAd,
} from "@/lib/screens/playlist";
import type { WeekSlidePayload } from "@/lib/screens/week";
import { WeekEventsSlide } from "@/components/screens/week-events-slide";

export function VerticalPlayer({
  initialAds,
  initialWeek = null,
  lockPlaylist = false,
}: {
  initialAds: PublicScreenAd[];
  initialWeek?: WeekSlidePayload | null;
  lockPlaylist?: boolean;
}) {
  const [ads, setAds] = useState(() => normalizePublicPlaylist(initialAds));
  const [week, setWeek] = useState(initialWeek);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const adsRef = useRef(ads);
  const revisionRef = useRef(playlistRevision(ads));
  const hostRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);

  useEffect(() => {
    adsRef.current = ads;
  }, [ads]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const update = () => {
      setScale(containScale(host.clientWidth, host.clientHeight));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (lockPlaylist) return;
    let cancelled = false;
    async function refresh() {
      try {
        const response = await fetch("/api/public/v1/screens/vertical", { cache: "no-store" });
        const playlist = (await response.json()) as {
          ads?: PublicScreenAd[];
          revision?: string;
          week?: WeekSlidePayload | null;
        };
        if (cancelled || !Array.isArray(playlist.ads)) return;
        const next = normalizePublicPlaylist(playlist.ads);
        const nextRevision = playlist.revision ?? playlistRevision(next);
        if (nextRevision !== revisionRef.current) {
          revisionRef.current = nextRevision;
          window.location.reload();
          return;
        }
        setAds((currentAds) => (playlistsEqual(currentAds, next) ? currentAds : next));
        if (playlist.week && Array.isArray(playlist.week.days)) setWeek(playlist.week);
      } catch {
        // keep current playlist
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), VERTICAL_PLAYLIST_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [lockPlaylist]);

  const current = ads.length > 0 ? ads[index % ads.length] : null;
  const currentId = current?.id ?? null;
  const showingWeek = current ? isWeekEventsAd(current) : false;

  useEffect(() => {
    if (!currentId) return;
    const ad = adsRef.current.find((item) => item.id === currentId);
    if (!ad) return;
    if (ad.mediaKind === "video" && ad.durationSeconds == null && !isWeekEventsAd(ad)) return;
    const hold = holdMsForAd(ad);
    const hideAt = Math.max(0, hold - transitionMs(ad.transition));
    const hideTimer = window.setTimeout(() => setVisible(false), hideAt);
    const nextTimer = window.setTimeout(() => {
      setIndex((value) => nextPlaylistIndex(value, adsRef.current.length));
      setVisible(true);
    }, hold);
    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(nextTimer);
    };
  }, [currentId]);

  return (
    <div ref={hostRef} className="relative h-full w-full overflow-hidden bg-[#1b1612]">
      <div
        className="absolute top-1/2 left-1/2 overflow-hidden bg-[#1b1612]"
        style={{
          width: VERTICAL_FRAME_WIDTH,
          height: VERTICAL_FRAME_HEIGHT,
          transform:
            scale == null
              ? `translate(-50%, -50%) scale(min(calc(100dvw / ${VERTICAL_FRAME_WIDTH}), calc(100dvh / ${VERTICAL_FRAME_HEIGHT})))`
              : `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        {!current ? (
          <div className="flex h-full w-full items-center justify-center text-center">
            <p className="px-16 text-4xl text-[#c9b8aa]">No ads scheduled</p>
          </div>
        ) : (
          <div
            className={`absolute inset-0 transition-all ${current.transition === "cut" ? "duration-0" : "duration-500"} ${
              visible
                ? "translate-x-0 opacity-100"
                : current.transition === "slide"
                  ? "-translate-x-24 opacity-0"
                  : "opacity-0"
            }`}
          >
            {showingWeek ? (
              <WeekEventsSlide week={week} loading={!week} />
            ) : current.mediaKind === "video" ? (
              <video
                key={current.id}
                src={current.url}
                className="h-full w-full object-contain"
                autoPlay
                muted
                playsInline
                onEnded={() => {
                  if (current.durationSeconds == null) {
                    setVisible(true);
                    setIndex((value) => (value + 1) % ads.length);
                  }
                }}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.url} alt={current.title} className="h-full w-full object-contain" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function transitionMs(transition: PublicScreenAd["transition"]) {
  if (transition === "cut") return 0;
  return 500;
}
