"use client";

import { useEffect, useRef } from "react";
import { parseYoutubeVideoUrl, youtubeEmbedUrl } from "@/lib/screens/youtube";

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement | string,
        options: {
          videoId: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (event: { target: YtPlayer }) => void;
            onStateChange?: (event: { data: number; target: YtPlayer }) => void;
            onError?: () => void;
          };
        },
      ) => YtPlayer;
      PlayerState: { ENDED: number; PLAYING: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

type YtPlayer = {
  destroy: () => void;
  playVideo: () => void;
  mute: () => void;
  unMute: () => void;
};

let youtubeApiPromise: Promise<void> | null = null;

function loadYoutubeApi() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise((resolve) => {
    const prior = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prior?.();
      resolve();
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    }
    // Already loaded between check and script inject.
    if (window.YT?.Player) resolve();
  });
  return youtubeApiPromise;
}

async function reportYoutubeEnded(sceneId: string, apiBase = "") {
  const url = `${apiBase}/api/public/v1/screens/led/youtube-ended`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sceneId }),
      cache: "no-store",
    });
  } catch {
    /* next poll / safety ends_at will still clear */
  }
}

export function LedYoutubePlayer({
  sceneId,
  url,
  apiBase = "",
}: {
  sceneId: string;
  url: string;
  apiBase?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const reportedRef = useRef(false);

  useEffect(() => {
    const parsed = parseYoutubeVideoUrl(url);
    if (!parsed || !hostRef.current) return;
    let player: YtPlayer | null = null;
    let cancelled = false;
    reportedRef.current = false;

    const finish = () => {
      if (cancelled || reportedRef.current) return;
      reportedRef.current = true;
      void reportYoutubeEnded(sceneId, apiBase);
    };

    void loadYoutubeApi().then(() => {
      if (cancelled || !hostRef.current || !window.YT?.Player) return;
      hostRef.current.replaceChildren();
      const mount = document.createElement("div");
      mount.id = `yt-${sceneId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40)}`;
      mount.style.cssText = "width:100%;height:100%";
      hostRef.current.appendChild(mount);
      player = new window.YT.Player(mount, {
        videoId: parsed.videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          fs: 0,
          iv_load_policy: 3,
        },
        events: {
          onReady: (event) => {
            try {
              event.target.unMute();
              event.target.playVideo();
            } catch {
              try {
                event.target.mute();
                event.target.playVideo();
              } catch {
                /* ignore */
              }
            }
          },
          onStateChange: (event) => {
            if (event.data === window.YT?.PlayerState.ENDED) finish();
          },
          onError: () => finish(),
        },
      });
    });

    return () => {
      cancelled = true;
      try {
        player?.destroy();
      } catch {
        /* ignore */
      }
    };
  }, [sceneId, url, apiBase]);

  // Fallback iframe if the API script is blocked — still shows video; end relies on safety timer.
  const parsed = parseYoutubeVideoUrl(url);
  const embed = parsed ? youtubeEmbedUrl(parsed.videoId) : url;

  return (
    <div className="relative h-full w-full bg-[#100e0c]">
      <div ref={hostRef} className="absolute inset-0 h-full w-full" />
      <noscript>
        <iframe
          title="YouTube"
          src={embed}
          className="absolute inset-0 h-full w-full border-0"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </noscript>
    </div>
  );
}
