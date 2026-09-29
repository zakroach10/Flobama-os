"use client";

import { useEffect, useState } from "react";
import { LedLoopVideo } from "@/components/screens/led-loop-video";
import { LED_DISPLAY_POLL_MS } from "@/lib/constants";
import { samePublicLedMedia } from "@/lib/screens/led-loop";
import type { PublicLedMedia } from "@/lib/screens/led-wall";

export function LedDisplay({ initial }: { initial: PublicLedMedia | null }) {
  const [media, setMedia] = useState<PublicLedMedia | null>(initial);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const response = await fetch("/api/public/v1/screens/led", { cache: "no-store" });
        const json = (await response.json()) as { active?: PublicLedMedia | null };
        if (cancelled) return;
        const next = json.active ?? null;
        setMedia((current) => (samePublicLedMedia(current, next) ? current : next));
      } catch {
        // Keep the clip that is already on screen.
      }
    }
    const timer = window.setInterval(() => void refresh(), LED_DISPLAY_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (!media) return <div className="h-full w-full bg-black" />;

  if (media.mediaKind === "video") {
    return <LedLoopVideo key={media.id} src={media.url} className="h-full w-full bg-black object-contain" />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={media.id} src={media.url} alt="" className="h-full w-full bg-black object-contain" />
  );
}
