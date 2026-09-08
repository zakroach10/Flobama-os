import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FloBama events",
  robots: { index: false, follow: false },
};

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-full bg-[#1b1612]">{children}</div>;
}
