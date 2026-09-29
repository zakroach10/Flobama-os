import type { NextConfig } from "next";
import { CAMERA_CONNECTOR_DMG_FILENAME, LED_OBS_DMG_FILENAME } from "./src/lib/constants";

const embeddable = [{ key: "Content-Security-Policy", value: "frame-ancestors *" }];
const dmgHeaders = (filename: string) => [
  { key: "Content-Type", value: "application/x-apple-diskimage" },
  { key: "Content-Disposition", value: `attachment; filename="${filename}"` },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  async headers() {
    return [
      {
        source: "/embed/:path*",
        headers: embeddable,
      },
      {
        source: "/overlay",
        headers: embeddable,
      },
      {
        source: "/display/:path*",
        headers: embeddable,
      },
      {
        source: `/downloads/${LED_OBS_DMG_FILENAME}`,
        headers: dmgHeaders(LED_OBS_DMG_FILENAME),
      },
      {
        source: `/downloads/${CAMERA_CONNECTOR_DMG_FILENAME}`,
        headers: dmgHeaders(CAMERA_CONNECTOR_DMG_FILENAME),
      },
    ];
  },
};

export default nextConfig;
