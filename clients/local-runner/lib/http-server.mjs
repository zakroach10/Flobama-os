import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { blobPath } from "./paths.mjs";
import { cacheBytesUsed, getAsset, listAssets } from "./cache-db.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WALL_DIR = join(__dirname, "..", "wall-player");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function safeAssetId(raw) {
  if (!raw || typeof raw !== "string") return null;
  if (!/^[a-zA-Z0-9._-]{1,120}$/.test(raw)) return null;
  return raw;
}

async function sendFile(res, filePath, mediaType, request) {
  const info = await stat(filePath);
  const size = info.size;
  const type = mediaType || MIME[extname(filePath).toLowerCase()] || "application/octet-stream";
  const range = request.headers.range;

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) {
      res.writeHead(416, { "content-range": `bytes */${size}` });
      res.end();
      return;
    }
    let start = match[1] ? Number(match[1]) : 0;
    let end = match[2] ? Number(match[2]) : size - 1;
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) {
      res.writeHead(416, { "content-range": `bytes */${size}` });
      res.end();
      return;
    }
    end = Math.min(end, size - 1);
    res.writeHead(206, {
      "content-type": type,
      "content-length": end - start + 1,
      "content-range": `bytes ${start}-${end}/${size}`,
      "accept-ranges": "bytes",
      "cache-control": "private, max-age=3600",
    });
    createReadStream(filePath, { start, end }).pipe(res);
    return;
  }

  res.writeHead(200, {
    "content-type": type,
    "content-length": size,
    "accept-ranges": "bytes",
    "cache-control": "private, max-age=3600",
  });
  createReadStream(filePath).pipe(res);
}

function playbackPayload(runtime) {
  const manifest = runtime.manifest;
  if (!manifest) {
    return {
      mode: "idle",
      revision: runtime.manifestRevision || "idle",
      startedAt: null,
      playlistId: null,
      reloadNonce: 1,
      items: [],
      active: null,
    };
  }

  const items = (manifest.items || []).map((item) => {
    if (!item.assetId) {
      return {
        id: item.slotId,
        sceneId: item.assetId,
        kind: item.kind === "obs" ? "obs" : item.kind,
        mediaKind: null,
        url: null,
        obsSceneName: item.obsSceneName,
        durationSeconds: item.durationSeconds,
      };
    }
    const cached = getAsset(runtime.db, item.assetId);
    const ready = cached?.state === "ready" && cached.sha256;
    const mediaType = cached?.mediaType || "";
    const mediaKind = mediaType.startsWith("video/")
      ? "video"
      : mediaType.startsWith("image/")
        ? "image"
        : "video";
    return {
      id: item.slotId,
      sceneId: item.assetId,
      kind: "media",
      mediaKind: ready ? mediaKind : null,
      url: ready ? `/media/${item.assetId}` : null,
      obsSceneName: item.obsSceneName,
      durationSeconds: item.durationSeconds,
    };
  });

  const mediaItems = items.filter((item) => item.kind === "media" && item.url);
  return {
    mode: manifest.mode === "scene" ? "scene" : manifest.mode === "playlist" ? "playlist" : items.length ? "playlist" : "idle",
    revision: manifest.revision,
    startedAt: manifest.startedAt,
    playlistId: manifest.playlistId,
    reloadNonce: manifest.reloadNonce ?? 1,
    items,
    playlist: items,
    active: mediaItems[0]
      ? {
          id: mediaItems[0].sceneId,
          title: mediaItems[0].sceneId,
          url: mediaItems[0].url,
          mediaKind: mediaItems[0].mediaKind,
        }
      : null,
    apiBase: runtime.config.apiBase,
  };
}

export function startHttpServer(runtime) {
  const host = runtime.config.bindHost || "127.0.0.1";
  const port = Number(runtime.config.bindPort || 4173);

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${host}:${port}`);
      const path = url.pathname;

      if (path === "/health") {
        sendJson(res, 200, { ok: true, uptime: process.uptime(), version: runtime.version });
        return;
      }

      if (path === "/status") {
        sendJson(res, 200, {
          ok: true,
          version: runtime.version,
          connected: runtime.connected,
          obsConnected: runtime.obsConnected,
          programScene: runtime.programScene,
          manifestRevision: runtime.manifestRevision,
          cacheBytes: cacheBytesUsed(runtime.db),
          cacheLimitBytes: runtime.config.maxCacheBytes,
          assetsReady: listAssets(runtime.db).filter((a) => a.state === "ready").length,
          assetsPending: listAssets(runtime.db).filter((a) => a.state === "downloading").length,
          downloads: runtime.state.downloads,
          lastError: runtime.state.lastError,
          wallUrl: `http://${host}:${port}/wall`,
        });
        return;
      }

      if (path === "/api/playback") {
        sendJson(res, 200, playbackPayload(runtime));
        return;
      }

      if (path.startsWith("/media/")) {
        const assetId = safeAssetId(decodeURIComponent(path.slice("/media/".length)));
        if (!assetId) {
          sendJson(res, 400, { error: "Invalid asset id." });
          return;
        }
        const asset = getAsset(runtime.db, assetId);
        if (!asset || asset.state !== "ready" || !asset.sha256) {
          sendJson(res, 409, { error: "Asset not ready." });
          return;
        }
        const filePath = asset.path || blobPath(runtime.db.cacheRoot, asset.sha256);
        // Prevent path traversal: only serve from blobs dir
        const blobsRoot = normalize(join(runtime.db.cacheRoot, "blobs"));
        if (!normalize(filePath).startsWith(blobsRoot)) {
          sendJson(res, 403, { error: "Forbidden." });
          return;
        }
        await sendFile(res, filePath, asset.mediaType, req);
        return;
      }

      if (path === "/wall" || path === "/wall/") {
        const html = await readFile(join(WALL_DIR, "index.html"));
        res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        res.end(html);
        return;
      }

      if (path.startsWith("/wall/")) {
        const name = path.slice("/wall/".length);
        if (name.includes("..") || name.includes("/") || name.includes("\\")) {
          res.writeHead(404);
          res.end();
          return;
        }
        const filePath = join(WALL_DIR, name);
        try {
          await sendFile(res, filePath, MIME[extname(filePath).toLowerCase()], req);
        } catch {
          res.writeHead(404);
          res.end();
        }
        return;
      }

      res.writeHead(404);
      res.end("Not found");
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : "Server error" });
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      runtime.log(`Local media server listening on http://${host}:${port}`);
      resolve(server);
    });
  });
}
