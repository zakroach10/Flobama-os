/* Server Station PWA service worker.
 * Caches static shell assets only. Never caches HTML, auth cookies,
 * API responses, or wall-command traffic.
 */
const CACHE = "server-station-static-v5";
const PRECACHE = [
  "/icons/server-station-180.png",
  "/icons/server-station-192.png",
  "/icons/server-station-512.png",
  "/icons/server-station-maskable-192.png",
  "/icons/server-station-maskable-512.png",
  "/server.webmanifest",
  "/flobama-logo.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept navigations or authenticated app shells.
  if (request.mode === "navigate") return;
  if (request.headers.get("accept")?.includes("text/html")) return;

  const path = url.pathname;
  const isStaticAsset =
    path.startsWith("/icons/") ||
    path === "/server.webmanifest" ||
    path === "/flobama-logo.png" ||
    path.startsWith("/_next/static/");

  if (!isStaticAsset) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      } catch (error) {
        if (cached) return cached;
        throw error;
      }
    }),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
