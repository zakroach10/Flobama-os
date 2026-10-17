/** Shared Server Station PWA metadata (manifest lives at /server.webmanifest). */
export const SERVER_STATION_PWA_NAME = "Server Station";
export const SERVER_STATION_PWA_MANIFEST_PATH = "/server.webmanifest";
export const SERVER_STATION_PWA_THEME_COLOR = "#14110f";
export const SERVER_STATION_SERVICE_WORKER_PATH = "/server-sw.js";

export const serverStationPwaMetadata = {
  title: SERVER_STATION_PWA_NAME,
  description: "Touchscreen Server Station for FloBama Music Hall floor staff.",
  manifest: SERVER_STATION_PWA_MANIFEST_PATH,
  applicationName: SERVER_STATION_PWA_NAME,
  appleWebApp: {
    capable: true,
    title: SERVER_STATION_PWA_NAME,
    statusBarStyle: "black-translucent" as const,
  },
  icons: [
    {
      url: "/icons/server-station-192.png",
      sizes: "192x192",
      type: "image/png",
    },
    {
      url: "/icons/server-station-512.png",
      sizes: "512x512",
      type: "image/png",
    },
  ],
};
