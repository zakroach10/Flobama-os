"use client";

import { useEffect } from "react";

export function EmbedHeightReporter() {
  useEffect(() => {
    function report() {
      const height = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
      window.parent.postMessage({ source: "flobama-embed", height }, "*");
    }
    report();
    const observer = new ResizeObserver(report);
    observer.observe(document.documentElement);
    window.addEventListener("load", report);
    return () => {
      observer.disconnect();
      window.removeEventListener("load", report);
    };
  }, []);
  return null;
}
