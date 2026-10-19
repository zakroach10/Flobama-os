import { createReadStream } from "node:fs";
import { lstat, realpath, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { findCatalogRecording } from "./recordings-catalog.mjs";
import { resolveUnderRecordingsRoot, PERFORMANCE_CACHE_DIR } from "./recordings-paths.mjs";
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
  const found = findCatalogRecording(catalog, recordingId);
  if (!found) {
    return {
      ok: false,
      status: 404,
      error:
        "Recording not found in the Local Runner catalog. Rescan recordings on the Mac, wait for catalog sync, then try again.",
    };
  }
  const { recordingId: catalogId, recording: rec } = found;

  const cachePath = convertedCachePath(catalogId);
  try {
    const info = await stat(cachePath);
    if (info.isFile() && info.size > 0) {
      const real = await realpath(cachePath);
      const cacheRoot = await realpath(PERFORMANCE_CACHE_DIR).catch(() => PERFORMANCE_CACHE_DIR);
      if (real.startsWith(cacheRoot + sep) || real === cacheRoot) {
        return {
          ok: true,
          path: real,
          mediaType: "video/mp4",
          source: "converted-cache",
          recordingId: catalogId,
          recording: rec,
        };
      }
    }
  } catch {
    /* no converted cache */
  }

  const root = catalog.data.recordingsRoot;
  // Prefer primary asset path when present (session model).
  const primaryRel =
    (Array.isArray(rec.assets) && rec.assets.find((a) => a.role === "primary")?.relativePath) ||
    rec.relativePath;
  if (!root || !primaryRel) {
    return { ok: false, status: 409, error: "Recordings root is not configured on the Local Runner." };
  }

  const resolved = await resolveUnderRecordingsRoot(root, primaryRel);
  if (!resolved) {
    return {
      ok: false,
      status: 403,
      error: `Cannot resolve local file under recordings root (${primaryRel}). Check the Dropbox path on the Mac.`,
    };
  }

  try {
    const linkInfo = await lstat(resolved);
    if (linkInfo.isSymbolicLink()) {
      return { ok: false, status: 403, error: "Symlink rejected." };
    }
  } catch {
    return { ok: false, status: 404, error: `Primary recording file missing: ${primaryRel}` };
  }

  if (rec.availability === "unsupported") {
    return { ok: false, status: 415, error: "Unsupported media." };
  }
  if (rec.availability === "missing") {
    return {
      ok: false,
      status: 409,
      error: "Recording is missing on the Mac. Rescan the Recordings folder.",
    };
  }

  // Live local-byte check is authoritative. Catalog "needs download" / "preparing" can
  // be stale or false-positive (recent mtime after scan, APFS allocation heuristics).
  try {
    const info = await stat(resolved);
    if (!info.size) {
      return {
        ok: false,
        status: 409,
        error: "Primary file size is 0 (online-only or empty). Make available offline in Dropbox.",
      };
    }
    const { open } = await import("node:fs/promises");
    const handle = await open(resolved, "r");
    try {
      const buf = Buffer.alloc(16);
      const { bytesRead } = await handle.read(buf, 0, 16, 0);
      if (bytesRead <= 0) {
        return {
          ok: false,
          status: 409,
          error: "Could not read file header (online-only placeholder). Make available offline in Dropbox.",
        };
      }
    } finally {
      await handle.close();
    }
  } catch (error) {
    const code = error && typeof error === "object" ? error.code : "";
    if (code === "ENOLINK" || code === "EREMOTE" || code === "EAGAIN" || code === "EBUSY") {
      return {
        ok: false,
        status: 409,
        error: `Cloud placeholder (${code}). Make available offline in Dropbox, then Prepare for playback.`,
      };
    }
    return {
      ok: false,
      status: 404,
      error: error instanceof Error ? error.message : "Primary recording file missing.",
    };
  }

  return {
    ok: true,
    path: resolved,
    mediaType: recordingMediaType(resolved),
    source: "dropbox-local",
    recordingId: catalogId,
    recording: rec,
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
