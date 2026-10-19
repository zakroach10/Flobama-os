import type { Metadata, Viewport } from "next";
import { ServerStationPwaRegister } from "@/components/pwa/server-station-pwa-register";
import { ServerStationViewportLock } from "@/components/server-station/station-viewport";
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
  // Keep the virtual keyboard from resizing the layout viewport (dock stays put).
  interactiveWidget: "overlays-content",
};

export default function ServerStationLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-x-0 overflow-hidden bg-[#100e0c] text-[#f7efe6]"
      style={{
        top: "var(--station-top, 0px)",
        height: "var(--station-vh, 100svh)",
        maxHeight: "var(--station-vh, 100svh)",
      }}
    >
      <ServerStationViewportLock />
      <ServerStationPwaRegister />
      {children}
    </div>
  );
}
