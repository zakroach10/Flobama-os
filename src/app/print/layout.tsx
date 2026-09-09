import type { Metadata } from "next";
import "./print.css";

export const metadata: Metadata = {
  title: "This week at FloBama",
  robots: { index: false, follow: false },
};

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-full bg-[#f3f3f3] print:bg-white">{children}</div>;
}
