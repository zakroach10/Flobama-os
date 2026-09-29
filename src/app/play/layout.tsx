import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "FloBama Trivia",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#1b1612] text-[#f7f1ea]">
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(211,107,74,0.22),transparent_40%),linear-gradient(180deg,#241c17,#1b1612_50%,#120e0c)]"
        aria-hidden
      />
      {children}
    </div>
  );
}
