"use client";

import { useRef } from "react";
import type { PublicLedMedia } from "@/lib/screens/led-wall";
import type { PreloadReportState } from "@/lib/screens/led-preload";

export function LedPreloadPool({
  items,
  onReady,
}: {
  items: PublicLedMedia[];
  onReady: (url: string) => void;
}) {
  const reported = useRef<Map<string, PreloadReportState>>(new Map());

  function reportKey(item: PublicLedMedia) {
    return `${item.id}\n${item.url}`;
  }

  function report(item: PublicLedMedia, state: PreloadReportState, message?: string) {
    const previous = reported.current.get(reportKey(item));
    if (previous === "ready" && state === "loading") return;
    if (previous === state) {
      if (state === "ready") onReady(item.url);
      return;
    }
    reported.current.set(reportKey(item), state);
    if (state === "ready") onReady(item.url);
    void message;
    // The hosted player is not the booth wall. Do not write preload status from this browser.
  }

  return (
    <div className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0" aria-hidden>
      {items.map((item) =>
        item.mediaKind === "video" ? (
          <video
            key={item.url}
            src={item.url}
            muted
            playsInline
            preload="auto"
            onLoadedMetadata={(event) => {
              event.currentTarget.muted = true;
              event.currentTarget.volume = 0;
            }}
            onLoadedData={() => report(item, "ready")}
            onError={() => report(item, "error", "Video did not load")}
            onLoadStart={() => report(item, "loading")}
          />
        ) : item.mediaKind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={item.url}
            src={item.url}
            alt=""
            ref={(node) => {
              if (!node) return;
              queueMicrotask(() => {
                if (!node.isConnected) return;
                if (node.complete && node.naturalWidth > 0) report(item, "ready");
                else if (node.complete) report(item, "error", "Image did not load");
                else report(item, "loading");
              });
            }}
            onLoad={() => report(item, "ready")}
            onError={() => report(item, "error", "Image did not load")}
          />
        ) : null,
      )}
    </div>
  );
}
