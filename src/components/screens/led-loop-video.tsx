"use client";

import { useEffect, useRef } from "react";
import { restartLedVideo, videoNearsEnd } from "@/lib/screens/led-loop";

export function LedLoopVideo({
  src,
  className,
  autoPlay = true,
}: {
  src: string;
  className: string;
  autoPlay?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = true;
    video.loop = true;
    let wrapped = false;

    const wrap = () => {
      if (wrapped) return;
      wrapped = true;
      restartLedVideo(video);
    };

    const onTimeUpdate = () => {
      if (video.currentTime < 0.25) {
        wrapped = false;
        return;
      }
      if (video.ended || videoNearsEnd(video.currentTime, video.duration)) wrap();
    };

    video.addEventListener("ended", wrap);
    video.addEventListener("timeupdate", onTimeUpdate);
    if (autoPlay) {
      try {
        const pending = video.play();
        if (pending && typeof pending.catch === "function") void pending.catch(() => undefined);
      } catch {
        // Autoplay can be blocked outside OBS. The element still restarts once it plays.
      }
    }

    return () => {
      video.removeEventListener("ended", wrap);
      video.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [autoPlay, src]);

  return (
    <video
      ref={ref}
      src={src}
      className={className}
      autoPlay={autoPlay}
      muted
      loop
      playsInline
      preload={autoPlay ? "auto" : "metadata"}
    />
  );
}
