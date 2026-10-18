import type { Metadata, Viewport } from "next";
import { ServerStationPwaRegister } from "@/components/pwa/server-station-pwa-register";
import {
  SERVER_STATION_PWA_THEME_COLOR,
  serverStationPwaMetadata,
} from "@/lib/pwa/server-station";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...serverStationPwaMetadata,
  title: "Flobama Toolkit",
  description: "Flobama Toolkit for floor staff.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: SERVER_STATION_PWA_THEME_COLOR,
  colorScheme: "dark",
};

export default function ServerStationLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 overflow-hidden bg-[#100e0c] text-[#f7efe6]">
      <ServerStationPwaRegister />
      {children}
    </div>
  );
}
