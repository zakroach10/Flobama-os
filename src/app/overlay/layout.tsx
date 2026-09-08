import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FloBama overlay",
  robots: { index: false, follow: false },
};

export default function OverlayLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-full bg-black text-white">{children}</div>;
}
