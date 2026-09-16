"use client";

import { accountInitials } from "@/lib/ghl/social";
import { cn } from "@/lib/utils";

export function PreviewAvatar({
  name,
  avatarUrl,
  className,
}: {
  name: string;
  avatarUrl?: string | null;
  className?: string;
}) {
  const initials = accountInitials(name);
  return (
    <span
      className={cn(
        "relative inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-300 text-xs font-semibold text-neutral-700",
        className,
      )}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- external GHL / CDN avatars
        <img src={avatarUrl} alt="" className="size-full object-cover" />
      ) : (
        <span aria-hidden>{initials}</span>
      )}
    </span>
  );
}

export function PreviewMedia({
  src,
  alt,
  pageCount,
  className,
  imgClassName,
  maxHeightClass,
}: {
  src: string;
  alt: string;
  pageCount: number;
  className?: string;
  imgClassName?: string;
  maxHeightClass?: string;
}) {
  return (
    <div className={cn("relative w-full overflow-hidden bg-neutral-100", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={cn("h-auto w-full object-cover", maxHeightClass, imgClassName)}
      />
      {pageCount > 1 ? (
        <span className="absolute top-2 right-2 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-semibold text-white">
          1 / {pageCount}
        </span>
      ) : null}
    </div>
  );
}

export function MoreDots({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      aria-hidden
      className={cn("size-5 text-neutral-500", className)}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 13a1 1 0 100-2 1 1 0 000 2zM19 13a1 1 0 100-2 1 1 0 000 2zM5 13a1 1 0 100-2 1 1 0 000 2z"
      />
    </svg>
  );
}
