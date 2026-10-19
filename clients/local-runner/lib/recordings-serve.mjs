import { createReadStream } from "node:fs";
import { lstat, realpath, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { resolveUnderRecordingsRoot } from "./recordings-paths.mjs";
import { PERFORMANCE_CACHE_DIR } from "./recordings-paths.mjs";
import { convertedCachePath } from "./recordings-probe.mjs";

const MIME = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
  ".mkv": "video/x-matroska",
};

export function recordingMediaType(filePath) {
  return MIME[extname(filePath).toLowerCase()] || "application/octet-stream";
}

/**
 * Resolve a playable local file for a recording id.
 * Prefers converted cache when present; otherwise the Dropbox path under recordingsRoot.
 */
export async function resolvePlayablePath(catalog, recordingId) {
  const rec = catalog.data.recordings[recordingId];
  if (!rec) return { ok: false, status: 404, error: "Recording not found." };

  const cachePath = convertedCachePath(recordingId);
  try {
    const info = await stat(cachePath);
    if (info.isFile() && info.size > 0) {
      const real = await realpath(cachePath);
      const cacheRoot = await realpath(PERFORMANCE_CACHE_DIR).catch(() => PERFORMANCE_CACHE_DIR);
      if (real.startsWith(cacheRoot + sep) || real === cacheRoot) {
        return { ok: true, path: real, mediaType: "video/mp4", source: "converted-cache" };
      }
    }
  } catch {
    /* no converted cache */
  }

  const root = catalog.data.recordingsRoot;
  if (!root || !rec.relativePath) {
    return { ok: false, status: 409, error: "Recordings root is not configured." };
  }

  const resolved = await resolveUnderRecordingsRoot(root, rec.relativePath);
  if (!resolved) {
    return { ok: false, status: 403, error: "Path rejected (traversal or symlink escape)." };
  }

  // Reject if the path is a symlink that escapes (resolveUnder already realpath-checks).
  try {
    const linkInfo = await lstat(resolved);
    if (linkInfo.isSymbolicLink()) {
      // Should not happen after realpath, but defend anyway.
      return { ok: false, status: 403, error: "Symlink rejected." };
    }
  } catch {
    return { ok: false, status: 404, error: "File missing." };
  }

  if (rec.availability === "needs download" || rec.availability === "missing") {
    return { ok: false, status: 409, error: `Recording is ${rec.availability}.` };
  }
  if (rec.availability === "unsupported") {
    return { ok: false, status: 415, error: "Unsupported media." };
  }
  if (rec.availability === "preparing") {
    return { ok: false, status: 409, error: "Recording is still being written." };
  }

  return {
    ok: true,
    path: resolved,
    mediaType: recordingMediaType(resolved),
    source: "dropbox-local",
  };
}

/**
 * HTTP HEAD / GET with byte-range support including suffix ranges and invalid-range 416.
 */
export async function sendRecordingFile(res, filePath, mediaType, request) {
  const info = await stat(filePath);
  const size = info.size;
  const type = mediaType || recordingMediaType(filePath);
  const method = (request.method || "GET").toUpperCase();
  const range = request.headers.range;

  const commonHeaders = {
    "content-type": type,
    "accept-ranges": "bytes",
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
  };

  if (!range) {
    res.writeHead(method === "HEAD" ? 200 : 200, {
      ...commonHeaders,
      "content-length": size,
    });
    if (method === "HEAD") {
      res.end();
      return;
    }
    createReadStream(filePath).pipe(res);
    return;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(String(range).trim());
  if (!match) {
    res.writeHead(416, { ...commonHeaders, "content-range": `bytes */${size}` });
    res.end();
    return;
  }

  let start;
  let end;
  const hasStart = match[1] !== "";
  const hasEnd = match[2] !== "";

  if (!hasStart && !hasEnd) {
    res.writeHead(416, { ...commonHeaders, "content-range": `bytes */${size}` });
    res.end();
    return;
  }

  if (!hasStart && hasEnd) {
    // Suffix range: bytes=-N
    const suffix = Number(match[2]);
    if (!Number.isFinite(suffix) || suffix <= 0) {
      res.writeHead(416, { ...commonHeaders, "content-range": `bytes */${size}` });
      res.end();
      return;
    }
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = hasEnd ? Number(match[2]) : size - 1;
  }

  if (
    Number.isNaN(start) ||
    Number.isNaN(end) ||
    start < 0 ||
    end < 0 ||
    start > end ||
    start >= size
  ) {
    res.writeHead(416, { ...commonHeaders, "content-range": `bytes */${size}` });
    res.end();
    return;
  }

  end = Math.min(end, size - 1);
  const length = end - start + 1;
  res.writeHead(206, {
    ...commonHeaders,
    "content-length": length,
    "content-range": `bytes ${start}-${end}/${size}`,
  });
  if (method === "HEAD") {
    res.end();
    return;
  }
  createReadStream(filePath, { start, end }).pipe(res);
}

/** Hardening helper for tests: ensure joined path stays under root. */
export function isPathInsideRoot(root, candidate) {
  const rootNorm = normalize(root.endsWith(sep) ? root : root + sep);
  const candNorm = normalize(candidate);
  return candNorm === normalize(root) || candNorm.startsWith(rootNorm);
}

void join;
