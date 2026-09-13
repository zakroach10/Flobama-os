import { cn } from "@/lib/utils";

/** Letter at 96dpi — matches Tailwind `w-[8.5in]` / `h-[11in]`. */
export const LETTER_PREVIEW_WIDTH = 816;
export const LETTER_PREVIEW_HEIGHT = 1056;

/**
 * Fits a fixed-pixel artboard into the current column without overflowing the
 * phone viewport. Width is the lesser of the container, `maxWidth`, and the
 * width that keeps the preview under `maxHeightVh`. Scale uses container
 * query units so it tracks the box, not a hardcoded 720px desktop cap.
 */
export function ScaledPreview({
  width,
  height,
  maxWidth = 720,
  maxHeightVh = 72,
  className,
  children,
}: {
  width: number;
  height: number;
  maxWidth?: number;
  maxHeightVh?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("mx-auto max-w-full", className)}
      style={{
        width: `min(100%, ${maxWidth}px, calc(${maxHeightVh}dvh * ${width} / ${height}))`,
        containerType: "inline-size",
      }}
    >
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: `${width} / ${height}` }}>
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{
            width,
            height,
            transform: `scale(calc(100cqi / ${width}))`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
