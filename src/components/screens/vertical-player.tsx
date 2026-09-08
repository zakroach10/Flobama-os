"use client";

import { useEffect, useState } from "react";
import { holdMsForAd, type PublicScreenAd } from "@/lib/screens/playlist";

export function VerticalPlayer({ initialAds }: { initialAds: PublicScreenAd[] }) {
  const [ads, setAds] = useState(initialAds);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const response = await fetch("/api/public/v1/screens/vertical", { cache: "no-store" });
        const json = (await response.json()) as { ads?: PublicScreenAd[] };
        if (!cancelled && Array.isArray(json.ads)) setAds(json.ads);
      } catch {
        // keep current playlist
      }
    }
    const timer = window.setInterval(() => void refresh(), 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const current = ads.length > 0 ? ads[index % ads.length] : null;

  useEffect(() => {
    if (!current || ads.length === 0) return;
    if (current.mediaKind === "video" && current.durationSeconds == null) return;
    const hold = holdMsForAd(current);
    const hideAt = Math.max(0, hold - transitionMs(current.transition));
    const hideTimer = window.setTimeout(() => setVisible(false), hideAt);
    const nextTimer = window.setTimeout(() => {
      setIndex((value) => (value + 1) % ads.length);
      setVisible(true);
    }, hold);
    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(nextTimer);
    };
  }, [ads.length, current]);

  return (
    <div className="grid h-full w-full place-items-center overflow-hidden bg-[#1b1612]">
      <div
        className="relative h-[1920px] w-[1080px] shrink-0 origin-center overflow-hidden bg-[#1b1612] [transform:scale(min(calc(100dvw/1080),calc(100dvh/1920)))]"
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
            {current.mediaKind === "video" ? (
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
