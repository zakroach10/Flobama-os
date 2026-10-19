"use client";

import { useEffect } from "react";

/**
 * Keep the Server Station shell height on the *visible* viewport.
 * iOS Safari/PWA `fixed inset-0` follows the large layout viewport, so the
 * bottom dock can drop by roughly one chrome/safe-area “space” when the URL
 * bar collapses or the visual viewport shifts. Pinning `--station-vh` to the
 * visual viewport (fallback: 100svh) stops that jump.
 */
export function ServerStationViewportLock() {
  useEffect(() => {
    const root = document.documentElement;

    const apply = () => {
      const vv = window.visualViewport;
      const height = Math.round(vv?.height ?? window.innerHeight);
      root.style.setProperty("--station-vh", `${height}px`);
      // Keep the shell glued to the visible top when iOS offsets the visual viewport.
      const offsetTop = Math.round(vv?.offsetTop ?? 0);
      root.style.setProperty("--station-top", `${offsetTop}px`);
    };

    apply();
    window.visualViewport?.addEventListener("resize", apply);
    window.visualViewport?.addEventListener("scroll", apply);
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    return () => {
      window.visualViewport?.removeEventListener("resize", apply);
      window.visualViewport?.removeEventListener("scroll", apply);
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      root.style.removeProperty("--station-vh");
      root.style.removeProperty("--station-top");
    };
  }, []);

  return null;
}
