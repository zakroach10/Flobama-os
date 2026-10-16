/** Shared FloBama Screens PWA metadata (manifest lives at /wall.webmanifest). */
export const WALL_OPS_PWA_NAME = "FloBama Screens";
export const WALL_OPS_PWA_MANIFEST_PATH = "/wall.webmanifest";
export const WALL_OPS_PWA_THEME_COLOR = "#1c1916";
export const WALL_OPS_SERVICE_WORKER_PATH = "/wall-sw.js";

export const wallOpsPwaMetadata = {
  title: WALL_OPS_PWA_NAME,
  description: "Venue LED wall and screen controls for FloBama Music Hall.",
  manifest: WALL_OPS_PWA_MANIFEST_PATH,
  applicationName: WALL_OPS_PWA_NAME,
  appleWebApp: {
    capable: true,
    title: WALL_OPS_PWA_NAME,
    statusBarStyle: "black-translucent" as const,
  },
  icons: [
    {
      url: "/icons/flobama-screens-192.png",
      sizes: "192x192",
      type: "image/png",
    },
    {
      url: "/icons/flobama-screens-512.png",
      sizes: "512x512",
      type: "image/png",
    },
  ],
};
