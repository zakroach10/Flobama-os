import type { NextConfig } from "next";

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
    ];
  },
};

export default nextConfig;
