import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Server Station · FloBama",
  description: "Touchscreen Server Station for FloBama Music Hall floor staff.",
  robots: { index: false, follow: false },
};

export default function ServerStationLayout({ children }: { children: React.ReactNode }) {
  return children;
}
