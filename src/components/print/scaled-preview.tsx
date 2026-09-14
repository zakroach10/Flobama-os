"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { previewContainScale } from "@/lib/print/preview-scale";
import { cn } from "@/lib/utils";

/** Letter at 96dpi — matches Tailwind `w-[8.5in]` / `h-[11in]`. */
export const LETTER_PREVIEW_WIDTH = 816;
export const LETTER_PREVIEW_HEIGHT = 1056;

/**
 * Fits a fixed-pixel artboard into the remaining viewport so the whole
 * preview is visible on phones and desktops (no page-scroll to see the edges).
 */
export function ScaledPreview({
  width,
  height,
  maxScale = 1,
  bottomReserve = 56,
  className,
  children,
}: {
  width: number;
  height: number;
  maxScale?: number;
  bottomReserve?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const measure = () => {
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const top = host.getBoundingClientRect().top;
      const availableWidth = host.clientWidth;
      const availableHeight = viewportHeight - top - bottomReserve;
      setScale(previewContainScale(width, height, availableWidth, availableHeight, maxScale));
    };

    measure();
    const parent = host.parentElement;
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    if (parent) observer.observe(parent);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
    };
  }, [width, height, maxScale, bottomReserve]);

  const displayWidth = Math.max(1, width * scale);
  const displayHeight = Math.max(1, height * scale);

  return (
    <div ref={hostRef} className="flex w-full justify-center">
      <div
        className={cn("relative overflow-hidden", className)}
        style={{ width: displayWidth, height: displayHeight }}
      >
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{
            width,
            height,
            transform: `scale(${scale})`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
