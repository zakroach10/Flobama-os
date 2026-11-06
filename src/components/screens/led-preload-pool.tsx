"use client";

import { useEffect, useRef } from "react";
import type { PublicLedMedia } from "@/lib/screens/led-wall";
import type { PreloadReportState } from "@/lib/screens/led-preload";

const CLIENT_KEY = "flobama-led-renderer";

function rendererKey() {
  if (typeof window === "undefined") return "server";
  try {
    const existing = window.sessionStorage.getItem(CLIENT_KEY);
    if (existing && existing.length >= 8) return existing;
    const next = crypto.randomUUID();
    window.sessionStorage.setItem(CLIENT_KEY, next);
    return next;
  } catch {
    return "led-renderer";
  }
}

export function LedPreloadPool({
  items,
  onReady,
}: {
  items: PublicLedMedia[];
  onReady: (url: string) => void;
}) {
  const reported = useRef<Map<string, PreloadReportState>>(new Map());
  const clientKey = useRef<string>("");

  useEffect(() => {
    clientKey.current = rendererKey();
  }, []);

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
    const key = clientKey.current || rendererKey();
    void fetch("/api/public/v1/screens/led/preload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientKey: key,
        reports: [{ sceneId: item.id, state, message: message ?? null }],
      }),
    }).catch(() => {
      /* status is optional; the decoded file still stays in this browser */
    });
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
