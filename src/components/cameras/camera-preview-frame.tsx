"use client";

import { useEffect, useRef, useState } from "react";

/**
 * iPhone Safari often fails to refresh `<img src="...?t=">` polls against an
 * authenticated API. Fetch the frame as a blob (with cookies) and keep the last
 * good frame on screen while waiting for the next one.
 */
export function CameraPreviewFrame({
  sessionId,
  alt,
  online,
  pollMs = 1200,
}: {
  sessionId: string;
  alt: string;
  online: boolean;
  pollMs?: number;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [misses, setMisses] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function pull() {
      if (cancelled || inFlight.current || document.visibilityState === "hidden") return;
      inFlight.current = true;
      try {
        const response = await fetch(`/api/media/v1/cameras/preview/${sessionId}?t=${Date.now()}`, {
          credentials: "same-origin",
          cache: "no-store",
          headers: { accept: "image/png,image/jpeg,image/*" },
        });
        if (cancelled) return;
        if (!response.ok) {
          setMisses((n) => {
            const next = n + 1;
            if (next >= 3) {
              setError(
                online
                  ? "Waiting for a frame from the Mac connector…"
                  : "Mac Camera app is not heartbeating. Open FloBama Mac Camera on the venue Mac (look for Cam ●), then tap Refresh preview.",
              );
            }
            return next;
          });
          return;
        }
        const blob = await response.blob();
        if (cancelled || !blob.size) return;
        const nextUrl = URL.createObjectURL(blob);
        const prev = urlRef.current;
        urlRef.current = nextUrl;
        setObjectUrl(nextUrl);
        setMisses(0);
        setError(null);
        if (prev) URL.revokeObjectURL(prev);
      } catch {
        if (cancelled) return;
        setMisses((n) => {
          const next = n + 1;
          if (next >= 3) {
            setError(
              online
                ? "Could not load preview on this phone. Check your connection, then tap Refresh preview."
                : "Mac Camera app is not heartbeating. Open FloBama Mac Camera, then tap Refresh preview.",
            );
          }
          return next;
        });
      } finally {
        inFlight.current = false;
      }
    }

    void pull();
    const id = window.setInterval(() => void pull(), pollMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") void pull();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [sessionId, online, pollMs]);

  return (
    <>
      {objectUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={objectUrl} alt={alt} className="h-full w-full object-contain" draggable={false} />
      ) : (
        <div className="flex h-full items-center justify-center p-6 text-center text-sm text-white/70">
          {online ? "Starting preview…" : "Waiting for Mac connector…"}
        </div>
      )}
      {error && misses >= 3 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/70 p-6 text-center text-sm text-white/80">
          {error}
        </div>
      ) : null}
    </>
  );
}
