"use client";

import { useEffect } from "react";
import { SERVER_STATION_SERVICE_WORKER_PATH } from "@/lib/pwa/server-station";

/** Registers the Server Station static-asset service worker (no HTML/API caching). */
export function ServerStationPwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let cancelled = false;

    async function register() {
      try {
        const registration = await navigator.serviceWorker.register(SERVER_STATION_SERVICE_WORKER_PATH, {
          scope: "/",
          updateViaCache: "none",
        });
        if (cancelled) return;
        registration.update().catch(() => {});
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              worker.postMessage("SKIP_WAITING");
            }
          });
        });
      } catch {
        // Installability still works without a SW on desktop Chromium; ignore register failures.
      }
    }

    void register();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
