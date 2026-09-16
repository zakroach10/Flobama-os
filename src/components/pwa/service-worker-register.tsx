"use client";

import { useEffect } from "react";

/** Registers the FloBama OS service worker for PWA + push on staff surfaces. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      /* Ignore insecure-origin / blocked registration failures */
    });
  }, []);
  return null;
}
