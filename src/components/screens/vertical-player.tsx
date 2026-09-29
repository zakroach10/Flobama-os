"use client";

import { useEffect, useRef, useState } from "react";
import { VERTICAL_PLAYLIST_POLL_MS } from "@/lib/constants";
import { containScale, VERTICAL_FRAME_HEIGHT, VERTICAL_FRAME_WIDTH } from "@/lib/screens/frame";
import {
  holdMsForAd,
  isWeekEventsAd,
  nextPlaylistIndex,
  normalizePublicPlaylist,
  playlistsEqual,
  type PublicScreenAd,
} from "@/lib/screens/playlist";
import { displayRevision, normalizePublicTakeover, type PublicTakeover } from "@/lib/screens/takeover";
import type { WeekSlidePayload } from "@/lib/screens/week";
import { FlobamaLogo } from "@/components/brand/flobama-logo";
import { TriviaKioskSlide, type TriviaKioskPromo } from "@/components/screens/trivia-kiosk-slide";
import { WeekEventsSlide } from "@/components/screens/week-events-slide";

export function VerticalPlayer({
  initialAds,
  initialWeek = null,
  initialTakeover = null,
  initialTrivia = null,
  lockPlaylist = false,
  initialIndex = 0,
}: {
  initialAds: PublicScreenAd[];
  initialWeek?: WeekSlidePayload | null;
  initialTakeover?: PublicTakeover | null;
  initialTrivia?: TriviaKioskPromo | null;
  lockPlaylist?: boolean;
  initialIndex?: number;
}) {
  const [ads, setAds] = useState(() => normalizePublicPlaylist(initialAds));
  const [week, setWeek] = useState(initialWeek);
  const [takeover, setTakeover] = useState(() => normalizePublicTakeover(initialTakeover));
  const [trivia, setTrivia] = useState<TriviaKioskPromo | null>(initialTrivia);
  const [index, setIndex] = useState(initialIndex);
  const [visible, setVisible] = useState(true);
  const adsRef = useRef(ads);
  const revisionRef = useRef(
    displayRevision(
      normalizePublicPlaylist(initialAds),
      normalizePublicTakeover(initialTakeover),
      initialTrivia ? `${initialTrivia.joinCode}:${initialTrivia.status}:${initialTrivia.playerCount}` : null,
    ),
  );
  const hostRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

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
          takeover?: PublicTakeover | null;
          trivia?: TriviaKioskPromo | null;
        };
        if (cancelled || !Array.isArray(playlist.ads)) return;
        const next = normalizePublicPlaylist(playlist.ads);
        const nextTakeover = normalizePublicTakeover(playlist.takeover);
        const nextTrivia = playlist.trivia ?? null;
        const triviaKey = nextTrivia
          ? `${nextTrivia.joinCode}:${nextTrivia.status}:${nextTrivia.playerCount}`
          : null;
        const nextRevision = playlist.revision ?? displayRevision(next, nextTakeover, triviaKey);
        if (nextRevision !== revisionRef.current) {
          revisionRef.current = nextRevision;
          window.location.reload();
          return;
        }
        setAds((currentAds) => (playlistsEqual(currentAds, next) ? currentAds : next));
        setTakeover(nextTakeover);
        setTrivia(nextTrivia);
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

  const holding = Boolean(trivia) || Boolean(takeover);
  const current = takeover?.ad ?? (ads.length > 0 ? ads[index % ads.length] : null);
  const currentId = current?.id ?? null;
  const showingWeek = current ? isWeekEventsAd(current) : false;

  useEffect(() => {
    if (!takeover?.endsAt) return;
    const remaining = Date.parse(takeover.endsAt) - Date.now();
    const timer = window.setTimeout(() => {
      window.location.reload();
    }, Math.max(250, remaining + 250));
    return () => window.clearTimeout(timer);
  }, [takeover?.endsAt]);

  useEffect(() => {
    if (!currentId || holding) return;
    const ad = adsRef.current.find((item) => item.id === currentId) ?? current;
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
  }, [current, currentId, holding]);

  return (
    <div ref={hostRef} className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#1b1612]">
      <div
        className="relative overflow-hidden bg-[#1b1612]"
        style={{
          width: VERTICAL_FRAME_WIDTH,
          height: VERTICAL_FRAME_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        {trivia ? (
          <TriviaKioskSlide promo={trivia} />
        ) : !current ? (
          <div className="flex h-full w-full flex-col items-center justify-center bg-[#1b1612] px-16 text-center">
            <FlobamaLogo className="w-[720px]" />
            <p className="mt-12 font-black tracking-[0.22em] text-[#f4ebe3] uppercase text-[40px]">
              Vertical screens
            </p>
            <p className="mt-5 text-[28px] font-medium tracking-[0.08em] text-[#8a7368]">Waiting for playlist</p>
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
            ) : (
              <div className="relative h-full w-full">
                {current.mediaKind === "video" ? (
                  <video
                    key={current.id}
                    src={current.url}
                    className="h-full w-full object-contain"
                    autoPlay
                    muted
                    playsInline
                    loop={holding}
                    onEnded={() => {
                      if (holding) {
                        setVisible(true);
                        return;
                      }
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
                <FlobamaLogo className="pointer-events-none absolute top-10 left-1/2 z-10 w-[280px] -translate-x-1/2 drop-shadow-[0_10px_22px_rgba(0,0,0,0.55)]" />
              </div>
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
