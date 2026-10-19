import type { NextConfig } from "next";
import {
  CAMERA_CONNECTOR_DMG_FILENAME,
  LED_OBS_DMG_FILENAME,
  LOCAL_RUNNER_DMG_FILENAME,
} from "./src/lib/constants";

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
  // Keep Local Runner / camera DMGs and Mac client sources out of serverless traces.
  outputFileTracingExcludes: {
    "*": [
      "./public/downloads/**",
      "./clients/**",
      "./tmp/**",
      "./scripts/**",
      "./tests/**",
      "./supabase/**",
    ],
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
      {
        source: `/downloads/${LOCAL_RUNNER_DMG_FILENAME}`,
        headers: dmgHeaders(LOCAL_RUNNER_DMG_FILENAME),
      },
      {
        source: "/wall-sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/wall.webmanifest",
        headers: [{ key: "Content-Type", value: "application/manifest+json" }],
      },
      {
        source: "/server-sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/server.webmanifest",
        headers: [{ key: "Content-Type", value: "application/manifest+json" }],
      },
    ];
  },
};

export default nextConfig;
