import type { NextConfig } from "next";

const embeddable = [{ key: "Content-Security-Policy", value: "frame-ancestors *" }];

const nextConfig: NextConfig = {
  poweredByHeader: false,
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
    ];
  },
};

export default nextConfig;
