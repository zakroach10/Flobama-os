import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Trivia LED wall",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#100e0c",
};

export default function TriviaWallShareLayout({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 overflow-hidden bg-[#100e0c] text-white">{children}</div>;
}
