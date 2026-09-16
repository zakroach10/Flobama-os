"use client";

import type { SocialAccount } from "@/lib/ghl/social";
import { instagramHandleFromName } from "@/lib/ghl/social";
import type { WeekSocialFormatId } from "@/lib/screens/social";
import { MoreDots, PreviewAvatar, PreviewMedia } from "@/components/social/previews/preview-shared";
import { cn } from "@/lib/utils";

function InstagramBadge() {
  return (
    <span className="absolute -right-0.5 -bottom-0.5 flex size-3.5 items-center justify-center rounded-[6px] bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#515bd4] ring-2 ring-white">
      <svg viewBox="0 0 24 24" className="size-2 fill-white" aria-hidden>
        <path d="M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5zm5 5a5 5 0 100 10 5 5 0 000-10zm6.5-.9a1.1 1.1 0 11-2.2 0 1.1 1.1 0 012.2 0z" />
      </svg>
    </span>
  );
}

function aspectForFormat(formatId: WeekSocialFormatId): string {
  if (formatId === "ig-portrait") return "aspect-[4/5]";
  if (formatId === "story") return "aspect-[9/16]";
  if (formatId === "landscape") return "aspect-video";
  return "aspect-square";
}

export function InstagramPreview({
  account,
  summary,
  mediaUrl,
  pageCount,
  formatId,
}: {
  account: SocialAccount;
  summary: string;
  mediaUrl: string;
  pageCount: number;
  formatId: WeekSocialFormatId;
}) {
  const handle = instagramHandleFromName(account.name) || "flobama";

  return (
    <article className="w-full overflow-hidden rounded-lg border border-neutral-300 bg-white pt-1 shadow-sm">
      <div className="mb-2 flex items-center justify-between px-3 py-2">
        <div className="flex min-w-0 items-center">
          <div className="relative">
            <PreviewAvatar name={account.name} avatarUrl={account.avatarUrl} />
            <InstagramBadge />
          </div>
          <div className="min-w-0 px-2 text-sm text-neutral-900">
            <div className="truncate font-semibold">{handle}</div>
          </div>
        </div>
        <MoreDots />
      </div>

      <div className={cn("relative w-full", aspectForFormat(formatId))}>
        <PreviewMedia
          src={mediaUrl}
          alt={`${account.name} Instagram preview`}
          pageCount={pageCount}
          className="absolute inset-0 h-full"
          imgClassName="h-full object-cover"
        />
      </div>

      <div className="mt-2 flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-3 text-neutral-900">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-5" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.111 3C19.633 3 22 6.353 22 9.48 22 15.814 12.178 21 12 21c-.178 0-10-5.186-10-11.52C2 6.352 4.367 3 7.889 3 9.91 3 11.233 4.024 12 4.924 12.767 4.024 14.089 3 16.111 3z" />
          </svg>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-5 -scale-x-100" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-12.385 8.342c-.2-.081-.3-.122-.38-.14a.909.909 0 00-.219-.024c-.083 0-.173.015-.353.045l-3.558.593c-.373.062-.56.093-.694.035a.5.5 0 01-.262-.262c-.058-.135-.027-.321.035-.694l.593-3.558c.03-.18.045-.27.045-.353a.907.907 0 00-.024-.219c-.018-.08-.059-.18-.14-.38A9 9 0 1121 12z" />
          </svg>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-5" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 13.5L21 3M10.627 13.828l2.628 6.758c.232.596.347.893.514.98a.5.5 0 00.462 0c.167-.086.283-.384.515-.979l6.59-16.888c.21-.537.315-.806.258-.977a.5.5 0 00-.316-.316c-.172-.057-.44.048-.978.257L3.413 9.253c-.595.233-.893.349-.98.516a.5.5 0 000 .461c.087.167.385.283.98.514l6.758 2.629c.121.046.182.07.233.106a.5.5 0 01.116.117c.037.05.06.111.107.232z" />
          </svg>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-5 text-neutral-900" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 7.8c0-1.68 0-2.52.327-3.162a3 3 0 011.311-1.311C7.28 3 8.12 3 9.8 3h4.4c1.68 0 2.52 0 3.162.327a3 3 0 011.311 1.311C19 5.28 19 6.12 19 7.8V21l-7-4-7 4V7.8z" />
        </svg>
      </div>

      <div className="px-4 pb-3 text-sm">
        <p className="text-neutral-900">
          <span className="mr-2 font-semibold">{handle}</span>
          <span className="whitespace-pre-wrap break-words">{summary || " "}</span>
        </p>
        <p className="mt-2 text-[13px] font-normal tracking-wide text-neutral-500 uppercase">Just now</p>
      </div>
    </article>
  );
}
