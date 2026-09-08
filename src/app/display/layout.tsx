import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "FloBama screens",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function DisplayLayout({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 overflow-hidden bg-[#1b1612] text-white">{children}</div>;
}
