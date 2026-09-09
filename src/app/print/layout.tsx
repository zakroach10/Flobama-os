import type { Metadata } from "next";
import "./print.css";

export const metadata: Metadata = {
  title: "This week at FloBama",
  robots: { index: false, follow: false },
};

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-full bg-[#1b1612] print:bg-[#1b1612]">{children}</div>;
}
