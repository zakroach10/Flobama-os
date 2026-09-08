"use client";

import { useEffect, useRef, useState } from "react";
import { holdMsForAd, nextPlaylistIndex, playlistsEqual, type PublicScreenAd } from "@/lib/screens/playlist";
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
  const [ads, setAds] = useState(initialAds);
  const [week, setWeek] = useState(initialWeek);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const adsRef = useRef(ads);
  adsRef.current = ads;

  useEffect(() => {
    if (lockPlaylist) return;
    let cancelled = false;
    async function refresh() {
      try {
        const [playlistRes, weekRes] = await Promise.all([
          fetch("/api/public/v1/screens/vertical", { cache: "no-store" }),
          fetch("/api/public/v1/screens/week", { cache: "no-store" }),
        ]);
        const playlist = (await playlistRes.json()) as { ads?: PublicScreenAd[] };
        const weekJson = (await weekRes.json()) as WeekSlidePayload;
        if (!cancelled && Array.isArray(playlist.ads)) {
          setAds((currentAds) => (playlistsEqual(currentAds, playlist.ads!) ? currentAds : playlist.ads!));
        }
        if (!cancelled && weekJson && Array.isArray(weekJson.days)) setWeek(weekJson);
      } catch {
        // keep current playlist
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [lockPlaylist]);

  const current = ads.length > 0 ? ads[index % ads.length] : null;
  const currentId = current?.id ?? null;

  useEffect(() => {
    if (!currentId) return;
    const ad = adsRef.current.find((item) => item.id === currentId);
    if (!ad) return;
    if (ad.mediaKind === "video" && ad.durationSeconds == null) return;
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
    <div className="grid h-full w-full place-items-center overflow-hidden bg-[#1b1612]">
      <div className="relative h-[1920px] w-[1080px] shrink-0 origin-center overflow-hidden bg-[#1b1612] [transform:scale(min(calc(100dvw/1080),calc(100dvh/1920)))]">
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
            {current.mediaKind === "week_events" ? (
              <WeekEventsSlide week={week} />
            ) : current.mediaKind === "video" ? (
              <video
                key={current.id}
                src={current.url}
                className="h-full w-full object-cover"
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
              <img src={current.url} alt={current.title} className="h-full w-full object-cover" />
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
