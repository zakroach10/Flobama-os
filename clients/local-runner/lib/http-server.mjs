import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { blobPath } from "./paths.mjs";
import { cacheBytesUsed, getAsset, listAssets } from "./cache-db.mjs";
import { catalogSyncPayload, getPerformanceState, listRecordings } from "./recordings-catalog.mjs";
import {
  discoverRecordingsCandidates,
  loadRecordingsSettings,
  openInFinder,
  saveRecordingsSettings,
} from "./recordings-paths.mjs";
import { inventoryExportRows, inventoryToCsv } from "./recordings-inventory.mjs";
import { resolvePlayablePath, sendRecordingFile } from "./recordings-serve.mjs";
import {
  applyPerformanceCommand,
  performancePlaybackPayload,
  prepareRecording,
  reportLocalProgress,
} from "./performance-controller.mjs";

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

export function playbackPayload(runtime) {
  // Performance mode takes priority over ad/scene rotation until stopped.
  if (runtime.recordingsCatalog) {
    const perfPayload = performancePlaybackPayload(runtime);
    if (perfPayload) return perfPayload;
  }

  const manifest = runtime.manifest;
  if (!manifest) {
    return {
      mode: "idle",
      revision: runtime.manifestRevision || "idle",
      startedAt: null,
      playlistId: null,
      // Prefer last known nonce so idle polls do not flap to 1 and trigger wall reloads.
      reloadNonce: Number(runtime.reloadNonce) || 1,
      items: [],
      playlist: [],
      active: null,
      apiBase: runtime.config?.apiBase || "",
      performance: runtime.recordingsCatalog ? getPerformanceState(runtime.recordingsCatalog) : null,
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
    performance: runtime.recordingsCatalog ? getPerformanceState(runtime.recordingsCatalog) : null,
  };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function safeRecordingId(raw) {
  if (!raw || typeof raw !== "string") return null;
  if (!/^[a-f0-9]{16,64}$/i.test(raw)) return null;
  return raw.toLowerCase();
}

export function startHttpServer(runtime) {
  const host = runtime.config.bindHost || "127.0.0.1";
  const port = Number(runtime.config.bindPort || 4173);

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${host}:${port}`);
      const path = url.pathname;
      const method = (req.method || "GET").toUpperCase();

      if (path === "/health") {
        sendJson(res, 200, { ok: true, uptime: process.uptime(), version: runtime.version });
        return;
      }

      if (path === "/status") {
        const perf = runtime.recordingsCatalog ? getPerformanceState(runtime.recordingsCatalog) : null;
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
          recordingsRoot: runtime.recordingsCatalog?.data?.recordingsRoot || null,
          recordingsCount: runtime.recordingsCatalog ? listRecordings(runtime.recordingsCatalog).length : 0,
          performanceMode: perf?.mode || "normal",
        });
        return;
      }

      if (path === "/api/playback") {
        sendJson(res, 200, playbackPayload(runtime));
        return;
      }

      // --- Performance Library local APIs (localhost only) ---
      if (path === "/api/recordings/settings" && method === "GET") {
        const settings = await loadRecordingsSettings();
        const candidates = await discoverRecordingsCandidates();
        sendJson(res, 200, {
          settings,
          candidates,
          activeRoot: runtime.recordingsCatalog?.data?.recordingsRoot || settings.recordingsRoot,
        });
        return;
      }

      if (path === "/api/recordings/settings" && method === "POST") {
        const body = await readJsonBody(req);
        const root = String(body.recordingsRoot || "").trim();
        if (!root) {
          sendJson(res, 400, { error: "recordingsRoot is required." });
          return;
        }
        const settings = await saveRecordingsSettings({
          recordingsRoot: root,
          defaultTimezone: body.timezone || "America/Chicago",
        });
        if (runtime.recordingsCatalog) {
          runtime.recordingsCatalog.data.recordingsRoot = settings.recordingsRoot;
        }
        runtime.pendingScan = true;
        sendJson(res, 200, { ok: true, settings });
        return;
      }

      if (path === "/api/recordings/discover" && method === "GET") {
        const candidates = await discoverRecordingsCandidates();
        sendJson(res, 200, { candidates });
        return;
      }

      if (path === "/api/recordings/open-finder" && method === "POST") {
        const body = await readJsonBody(req);
        const target =
          body.path ||
          runtime.recordingsCatalog?.data?.recordingsRoot ||
          (await loadRecordingsSettings()).recordingsRoot;
        if (!target) {
          sendJson(res, 400, { error: "No recordings folder configured." });
          return;
        }
        const result = await openInFinder(target);
        sendJson(res, result.ok ? 200 : 500, result);
        return;
      }

      if (path === "/api/recordings/scan" && method === "POST") {
        runtime.pendingScan = true;
        sendJson(res, 200, { ok: true, message: "Scan queued." });
        return;
      }

      if (path === "/api/recordings/catalog" && method === "GET") {
        if (!runtime.recordingsCatalog) {
          sendJson(res, 503, { error: "Catalog not ready." });
          return;
        }
        sendJson(res, 200, catalogSyncPayload(runtime.recordingsCatalog, runtime.config?.deviceId));
        return;
      }

      if (path === "/api/recordings/export.json" && method === "GET") {
        if (!runtime.recordingsCatalog) {
          sendJson(res, 503, { error: "Catalog not ready." });
          return;
        }
        sendJson(res, 200, {
          exportedAt: new Date().toISOString(),
          recordingsRoot: runtime.recordingsCatalog.data.recordingsRoot,
          scanStats: runtime.recordingsCatalog.data.scanStats,
          nonVideo: runtime.recordingsCatalog.data.nonVideo,
          rows: inventoryExportRows(runtime.recordingsCatalog.data),
        });
        return;
      }

      if (path === "/api/recordings/export.csv" && method === "GET") {
        if (!runtime.recordingsCatalog) {
          sendJson(res, 503, { error: "Catalog not ready." });
          return;
        }
        const csv = inventoryToCsv(inventoryExportRows(runtime.recordingsCatalog.data));
        res.writeHead(200, {
          "content-type": "text/csv; charset=utf-8",
          "cache-control": "no-store",
          "content-disposition": "attachment; filename=\"performance-inventory.csv\"",
        });
        res.end(csv);
        return;
      }

      if (path === "/api/recordings/prepare" && method === "POST") {
        const body = await readJsonBody(req);
        const recordingId = safeRecordingId(body.recordingId);
        if (!recordingId) {
          sendJson(res, 400, { error: "Invalid recordingId." });
          return;
        }
        const result = await prepareRecording(runtime, recordingId);
        sendJson(res, result.ok ? 200 : 409, result);
        return;
      }

      if (path === "/api/performance/progress" && method === "POST") {
        const body = await readJsonBody(req);
        const state = await reportLocalProgress(runtime, body);
        sendJson(res, 200, { ok: true, performance: state });
        return;
      }

      if (path === "/api/performance/command" && method === "POST") {
        // Local operator console only — remote staff must use authenticated OS APIs.
        const body = await readJsonBody(req);
        const result = await applyPerformanceCommand(runtime, body);
        sendJson(res, result.status === "rejected" ? 400 : 200, result);
        return;
      }

      if (path.startsWith("/recordings/") && path.endsWith("/media")) {
        const idPart = path.slice("/recordings/".length, -"/media".length).replace(/\/$/, "");
        const recordingId = safeRecordingId(decodeURIComponent(idPart));
        if (!recordingId) {
          sendJson(res, 400, { error: "Invalid recording id." });
          return;
        }
        if (!runtime.recordingsCatalog) {
          sendJson(res, 503, { error: "Catalog not ready." });
          return;
        }
        const playable = await resolvePlayablePath(runtime.recordingsCatalog, recordingId);
        if (!playable.ok) {
          sendJson(res, playable.status || 409, { error: playable.error });
          return;
        }
        if (method !== "GET" && method !== "HEAD") {
          res.writeHead(405);
          res.end();
          return;
        }
        await sendRecordingFile(res, playable.path, playable.mediaType, req);
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
