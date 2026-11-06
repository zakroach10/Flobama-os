import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Live Trivia",
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
  // Brand colors are applied by TriviaPlayClient from the active pack.
  return <div className="min-h-dvh">{children}</div>;
}
