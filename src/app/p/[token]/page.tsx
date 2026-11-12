import type { Metadata } from "next";
import { FlobamaLogo } from "@/components/brand/flobama-logo";
import { formatPhotoBoothExpiry } from "@/lib/photo-booth/frame";
import { loadPhotoBoothShare } from "@/lib/photo-booth/load-share";

export const metadata: Metadata = {
  title: "Your FloBama photo",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic";

export default async function PhotoSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = await loadPhotoBoothShare(token);
  if (!share.ok) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-[#14110e] px-6 py-12 text-center text-[#f6efe6]">
        <FlobamaLogo className="mb-8 w-48" />
        <h1 className="text-3xl font-semibold">Photo unavailable</h1>
        <p className="mt-4 max-w-sm text-lg text-[#c9b8aa]">{share.message}</p>
      </main>
    );
  }

  const src = `/api/public/v1/photo-booth/${encodeURIComponent(token)}`;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center bg-[#14110e] px-5 py-8 text-center text-[#f6efe6]">
      <FlobamaLogo className="w-44" />
      <p className="mt-6 text-xs tracking-[0.35em] text-[#e4572e] uppercase">FloBama photo booth</p>
      <h1 className="mt-2 text-3xl font-semibold">{share.eventLabel ?? "Your photo"}</h1>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Your FloBama photo booth picture"
        className="mt-6 aspect-[1080/1620] w-full rounded-2xl bg-black object-contain"
      />
      <a
        href={`${src}?download=1`}
        download="flobama-photo.jpg"
        rel="noreferrer"
        className="mt-6 flex min-h-14 w-full items-center justify-center rounded-full bg-[#e4572e] text-lg font-semibold text-white"
      >
        Save photo
      </a>
      <p className="mt-4 text-sm leading-relaxed text-[#c9b8aa]">
        Anyone with this link can view it until {formatPhotoBoothExpiry(share.expiresAt)}. Then it is deleted.
        If the button doesn&apos;t save it, press and hold the photo.
      </p>
    </main>
  );
}
