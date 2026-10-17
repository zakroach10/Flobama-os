import type { Metadata, Viewport } from "next";
import { ServerStationPwaRegister } from "@/components/pwa/server-station-pwa-register";
import {
  SERVER_STATION_PWA_THEME_COLOR,
  serverStationPwaMetadata,
} from "@/lib/pwa/server-station";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...serverStationPwaMetadata,
  title: "Server Station · FloBama",
  description: "Touchscreen Server Station for FloBama Music Hall floor staff.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: SERVER_STATION_PWA_THEME_COLOR,
  colorScheme: "dark",
};

export default function ServerStationLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ServerStationPwaRegister />
      {children}
    </>
  );
}
