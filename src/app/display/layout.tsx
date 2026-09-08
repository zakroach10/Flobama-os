import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FloBama screens",
  robots: { index: false, follow: false },
};

export default function DisplayLayout({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 overflow-hidden bg-[#1b1612] text-white">{children}</div>;
}
