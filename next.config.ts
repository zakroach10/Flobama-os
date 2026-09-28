import type { NextConfig } from "next";
import { LED_OBS_DMG_FILENAME } from "./src/lib/constants";

const embeddable = [{ key: "Content-Security-Policy", value: "frame-ancestors *" }];

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
        source: "/downloads/:file*",
        headers: [
          { key: "Content-Type", value: "application/x-apple-diskimage" },
          { key: "Content-Disposition", value: `attachment; filename="${LED_OBS_DMG_FILENAME}"` },
        ],
      },
    ];
  },
};

export default nextConfig;
