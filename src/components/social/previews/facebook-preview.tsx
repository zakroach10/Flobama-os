"use client";

import type { SocialAccount } from "@/lib/ghl/social";
import { MoreDots, PreviewAvatar, PreviewMedia } from "@/components/social/previews/preview-shared";

function FacebookIcon() {
  return (
    <span className="absolute -right-0.5 -bottom-0.5 flex size-3.5 items-center justify-center rounded-full bg-[#1877F2] ring-2 ring-white">
      <svg viewBox="0 0 24 24" className="size-2.5 fill-white" aria-hidden>
        <path d="M14 8h3V4h-3c-2.2 0-4 1.8-4 4v2H8v4h2v8h4v-8h3l1-4h-4V8c0-.6.4-1 1-1z" />
      </svg>
    </span>
  );
}

export function FacebookPreview({
  account,
  summary,
  mediaUrl,
  pageCount,
}: {
  account: SocialAccount;
  summary: string;
  mediaUrl: string;
  pageCount: number;
}) {
  return (
    <article className="w-full overflow-hidden rounded-lg border border-neutral-300 bg-white pt-1 shadow-sm">
      <div className="flex items-start justify-between px-3 py-2">
        <div className="flex items-start">
          <div className="relative">
            <PreviewAvatar name={account.name} avatarUrl={account.avatarUrl} />
            <FacebookIcon />
          </div>
          <div className="flex flex-col items-start px-2">
            <span className="text-sm font-semibold text-neutral-900">{account.name}</span>
            <p className="mt-0.5 text-xs font-medium tracking-wide text-neutral-400 uppercase">Just now</p>
          </div>
        </div>
        <MoreDots className="-translate-y-1" />
      </div>

      {summary.trim() ? (
        <p className="block px-3 py-3 text-left text-sm whitespace-pre-wrap text-neutral-900 break-words">
          {summary}
        </p>
      ) : null}

      <PreviewMedia
        src={mediaUrl}
        alt={`${account.name} Facebook preview`}
        pageCount={pageCount}
        className="bg-black"
        maxHeightClass="max-h-[420px]"
      />

      <div className="flex items-center justify-between px-5 py-3 text-sm font-semibold text-neutral-500">
        <span className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-4" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 22V11m-5 2v7a2 2 0 002 2h13.426a3 3 0 002.965-2.544l1.077-7A3 3 0 0018.503 9H15a1 1 0 01-1-1V4.466A2.466 2.466 0 0011.534 2a.822.822 0 00-.75.488l-3.52 7.918A1 1 0 016.35 11H4a2 2 0 00-2 2z" />
          </svg>
          Like
        </span>
        <span className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-4" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.8c0-1.68 0-2.52.327-3.162a3 3 0 011.311-1.311C5.28 3 6.12 3 7.8 3h8.4c1.68 0 2.52 0 3.162.327a3 3 0 011.311 1.311C21 5.28 21 6.12 21 7.8v5.4c0 1.68 0 2.52-.327 3.162a3 3 0 01-1.311 1.311C18.72 18 17.88 18 16.2 18h-2.516c-.624 0-.936 0-1.235.061a2.997 2.997 0 00-.761.267c-.272.14-.516.334-1.003.724L8.3 20.96c-.416.333-.624.5-.8.5a.5.5 0 01-.39-.188C7 21.135 7 20.868 7 20.336V18c-.93 0-1.395 0-1.776-.102a3 3 0 01-2.122-2.121C3 15.395 3 14.93 3 14V7.8z" />
          </svg>
          Comment
        </span>
        <span className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-4" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.791 12.607c.244-.209.366-.313.411-.438a.5.5 0 000-.338c-.045-.124-.167-.23-.41-.438L12.32 4.132c-.42-.36-.63-.54-.809-.545a.5.5 0 00-.4.184C11 3.91 11 4.186 11 4.74v4.296a9.666 9.666 0 00-8 9.516v.612a11.401 11.401 0 018-4.093v4.19c0 .554 0 .83.112.969a.5.5 0 00.4.184c.178-.005.388-.185.809-.545l8.47-7.26z" />
          </svg>
          Share
        </span>
      </div>
    </article>
  );
}
