import type { Metadata } from "next";
import { Inter, Oswald } from "next/font/google";
import { SiteShell } from "@/components/site/site-shell";
import "./site.css";

const siteSans = Inter({
  subsets: ["latin"],
  variable: "--font-site-sans",
});

const siteHeading = Oswald({
  subsets: ["latin"],
  variable: "--font-site-heading",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "FloBama Music Hall",
    template: "%s · FloBama",
  },
  description:
    "Southern food, ice-cold drinks, and live music in downtown Florence, Alabama.",
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`flobama-site dark min-h-dvh ${siteSans.variable} ${siteHeading.variable}`}>
      <SiteShell>{children}</SiteShell>
    </div>
  );
}
