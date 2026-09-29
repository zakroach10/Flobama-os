"use client";

import { useEffect, useState } from "react";
import { LED_DISPLAY_POLL_MS } from "@/lib/constants";
import type { PublicLedMedia } from "@/lib/screens/led-wall";
import type { TriviaWallState } from "@/lib/trivia/types";
import { TriviaWall } from "@/components/screens/trivia-wall";

export function LedDisplay({
  initial,
  initialTrivia = null,
  lockTriviaDemo = false,
}: {
  initial: PublicLedMedia | null;
  initialTrivia?: TriviaWallState | null;
  lockTriviaDemo?: boolean;
}) {
  const [media, setMedia] = useState<PublicLedMedia | null>(initial);
  const [trivia, setTrivia] = useState<TriviaWallState | null>(initialTrivia);

  useEffect(() => {
    if (lockTriviaDemo) return;
    let cancelled = false;
    async function refresh() {
      try {
        const [ledRes, triviaRes] = await Promise.all([
          fetch("/api/public/v1/screens/led", { cache: "no-store" }),
          fetch("/api/public/v1/trivia/wall", { cache: "no-store" }),
        ]);
        const ledJson = (await ledRes.json()) as { active?: PublicLedMedia | null };
        const triviaJson = (await triviaRes.json()) as { trivia?: TriviaWallState | null };
        if (cancelled) return;
        setMedia(ledJson.active ?? null);
        setTrivia(triviaJson.trivia ?? null);
      } catch {
        if (!cancelled) {
          setMedia((current) => current);
          setTrivia((current) => current);
        }
      }
    }
    const timer = window.setInterval(() => void refresh(), LED_DISPLAY_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [lockTriviaDemo]);

  if (trivia) return <TriviaWall initial={trivia} lockDemo={lockTriviaDemo} />;

  if (!media) return <div className="h-full w-full bg-black" />;

  if (media.mediaKind === "video") {
    return (
      <video
        key={media.id}
        src={media.url}
        className="h-full w-full bg-black object-contain"
        autoPlay
        muted
        loop
        playsInline
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={media.id} src={media.url} alt="" className="h-full w-full bg-black object-contain" />
  );
}
