import { createReadStream } from "node:fs";
import { open, readdir, stat } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";
import {
  ecammSkipReason,
  isMainEcammRecording,
  isVideoFilename,
  relativeFromRoot,
  stableRecordingId,
} from "./recordings-paths.mjs";
import { parseRecordingFilename } from "./recordings-parse.mjs";

const GROWING_WINDOW_MS = 15_000;
const BATCH_DEFAULT = 200;

/**
 * Detect online-only / cloud placeholders without hydrating.
 * Conservative: never force Dropbox to download during inventory.
 */
export async function detectLocalAvailability(filePath, info) {
  // Zero-size files are not playable.
  if (!info.size) {
    return { availability: "needs download", reason: "File size is 0 (likely online-only or empty)." };
  }

  // Growing / still recording: mtime very recent and size changing would be checked by caller.
  const ageMs = Date.now() - info.mtimeMs;
  if (ageMs >= 0 && ageMs < GROWING_WINDOW_MS) {
    return { availability: "preparing", reason: "File was modified within the last 15s — may still be recording." };
  }

  // Try reading a few bytes without requesting cloud hydration when possible.
  // On macOS cloud providers, opening may still hydrate; we use a short read and treat
  // ENOLINK / EREMOTE / EAGAIN-style failures as needs-download.
  try {
    const handle = await open(filePath, "r");
    try {
      const buf = Buffer.alloc(16);
      const { bytesRead } = await handle.read(buf, 0, 16, 0);
      if (bytesRead <= 0) {
        return { availability: "needs download", reason: "Could not read file header (online-only placeholder)." };
      }
    } finally {
      await handle.close();
    }
  } catch (error) {
    const code = error && typeof error === "object" ? error.code : "";
    if (code === "ENOLINK" || code === "EREMOTE" || code === "EAGAIN" || code === "EBUSY") {
      return { availability: "needs download", reason: `Cloud placeholder (${code}). Make available offline in Dropbox.` };
    }
    if (code === "ENOENT") {
      return { availability: "missing", reason: "File missing." };
    }
    return { availability: "error", reason: error instanceof Error ? error.message : String(error) };
  }

  // blocks vs size heuristic (dataless files often report fewer allocated blocks).
  const blocks = Number(info.blocks) || 0;
  const blockSize = Number(info.blksize) || 512;
  const allocated = blocks * blockSize;
  if (info.size > 1_000_000 && allocated > 0 && allocated < info.size * 0.05) {
    return {
      availability: "needs download",
      reason: "Allocated disk size is far smaller than logical size (likely online-only).",
    };
  }

  return { availability: "metadata-only", reason: null };
}

async function* walkFiles(root) {
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const name = entry.name;
      if (name === ".DS_Store" || name === ".dropbox" || name.startsWith("~$")) continue;
      const full = join(dir, name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (entry.isSymbolicLink()) {
        // Record symlink presence but do not follow for inventory escape safety —
        // resolveUnderRecordingsRoot will reject escapes at serve time.
        yield { full, name, isSymlink: true };
        continue;
      }
      if (entry.isFile()) {
        yield { full, name, isSymlink: false };
      }
    }
  }
}

/**
 * Incremental recursive inventory. Does not read full file contents or generate thumbnails.
 */
export async function inventoryRecordingsFolder(recordingsRoot, options = {}) {
  const timeZone = options.timeZone || "America/Chicago";
  const batchSize = options.batchSize || BATCH_DEFAULT;
  const onBatch = options.onBatch || null;

  const scanned = [];
  const nonVideo = [];
  const unsupported = [];
  let totalFiles = 0;
  let videoFiles = 0;
  let skippedCameraOrNonEcamm = 0;
  let errorCount = 0;

  let batch = [];

  for await (const entry of walkFiles(recordingsRoot)) {
    totalFiles += 1;
    const rel = relativeFromRoot(recordingsRoot, entry.full);
    if (!rel) {
      nonVideo.push({
        relativePath: relative(recordingsRoot, entry.full).split(sep).join("/"),
        originalFilename: entry.name,
        reason: "Path escaped recordings root.",
      });
      continue;
    }

    let info;
    try {
      info = await stat(entry.full);
    } catch (error) {
      errorCount += 1;
      nonVideo.push({
        relativePath: rel,
        originalFilename: entry.name,
        reason: error instanceof Error ? error.message : "stat failed",
      });
      continue;
    }

    if (!isVideoFilename(entry.name)) {
      nonVideo.push({
        relativePath: rel,
        originalFilename: entry.name,
        fileSize: info.size,
        reason: "Not a supported video extension.",
      });
      continue;
    }

    // Recurse into every session folder, but only catalog main Ecamm program files.
    if (!isMainEcammRecording(entry.name)) {
      skippedCameraOrNonEcamm += 1;
      nonVideo.push({
        relativePath: rel,
        originalFilename: entry.name,
        fileSize: info.size,
        reason: ecammSkipReason(entry.name) || "Skipped (not main Ecamm recording).",
      });
      continue;
    }

    videoFiles += 1;
    const recordingId = stableRecordingId(rel);
    // Prefer parent folder name in the haystack — Ecamm puts the full date there.
    const parsed = parseRecordingFilename(entry.name, { timeZone, relativePath: rel });
    const local = await detectLocalAvailability(entry.full, info);

    const ext = extname(entry.name).toLowerCase();
    // Extension present in VIDEO_EXTENSIONS but container may still be unsupported for wall.
    const record = {
      recordingId,
      originalFilename: entry.name,
      relativePath: rel,
      // absolutePath stays local-only
      absolutePath: entry.full,
      fileSize: info.size,
      birthtimeMs: info.birthtimeMs || null,
      mtimeMs: info.mtimeMs || null,
      blocks: info.blocks ?? null,
      isSymlink: entry.isSymlink,
      extension: ext,
      parsedTimestamp: parsed.ok ? parsed.parsedTimestamp : null,
      rawTimestampText: parsed.rawTimestampText,
      timezone: parsed.timezone || timeZone,
      parseSource: parsed.parseSource,
      parseConfidence: parsed.parseConfidence,
      parseDateOnly: Boolean(parsed.dateOnly),
      parseError: parsed.ok ? null : parsed.error || null,
      ambiguousDst: Boolean(parsed.ambiguousDst),
      availability: local.availability,
      lastError: local.reason,
      durationSeconds: null,
      container: null,
      videoCodec: null,
      audioCodec: null,
      width: null,
      height: null,
      hasAudio: null,
      playbackCompatible: null,
      needsConversion: false,
      probe: null,
    };

    if (local.availability === "metadata-only") {
      // Mark as ready for local path serving once we confirm bytes; probing deferred.
      record.availability = "ready";
    }

    scanned.push(record);
    batch.push(record);
    if (batch.length >= batchSize) {
      if (onBatch) await onBatch(batch);
      batch = [];
    }
  }

  if (batch.length && onBatch) await onBatch(batch);

  const stats = {
    totalFiles,
    videoFiles,
    skippedCameraOrNonEcamm,
    nonVideoFiles: nonVideo.length,
    unsupportedFiles: unsupported.length,
    errorCount,
    scannedAt: new Date().toISOString(),
  };

  return { scanned, nonVideo, unsupported, stats };
}

/**
 * Export inventory as JSON-serializable rows (no absolute paths).
 */
export function inventoryExportRows(catalogData) {
  const recordings = Object.values(catalogData.recordings || {});
  return recordings.map((rec) => ({
    recordingId: rec.recordingId,
    originalFilename: rec.originalFilename,
    relativePath: rec.relativePath,
    fileSize: rec.fileSize,
    availability: rec.availability,
    parsedTimestamp: rec.parsedTimestamp,
    rawTimestampText: rec.rawTimestampText,
    timezone: rec.timezone,
    parseSource: rec.parseSource,
    parseConfidence: rec.parseConfidence,
    durationSeconds: rec.durationSeconds,
    eventId: rec.matchedEventId || null,
    matchConfidence: rec.matchConfidence || null,
    matchReason: rec.matchReason || null,
    displayTitle: rec.displayTitleOverride || null,
    lastError: rec.lastError || null,
  }));
}

export function inventoryToCsv(rows) {
  const headers = [
    "recordingId",
    "originalFilename",
    "relativePath",
    "fileSize",
    "availability",
    "parsedTimestamp",
    "rawTimestampText",
    "timezone",
    "parseSource",
    "parseConfidence",
    "durationSeconds",
    "eventId",
    "matchConfidence",
    "matchReason",
    "displayTitle",
    "lastError",
  ];
  const escape = (value) => {
    if (value == null) return "";
    const s = String(value);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

/** Soft re-check for still-growing files without full rescan. */
export async function recheckGrowingFiles(catalog) {
  const updates = [];
  for (const rec of Object.values(catalog.data.recordings)) {
    if (rec.availability !== "preparing" || !rec.absolutePath) continue;
    try {
      const info = await stat(rec.absolutePath);
      const ageMs = Date.now() - info.mtimeMs;
      if (ageMs >= GROWING_WINDOW_MS) {
        const local = await detectLocalAvailability(rec.absolutePath, info);
        updates.push({
          recordingId: rec.recordingId,
          fileSize: info.size,
          mtimeMs: info.mtimeMs,
          availability: local.availability === "metadata-only" ? "ready" : local.availability,
          lastError: local.reason,
        });
      }
    } catch {
      updates.push({
        recordingId: rec.recordingId,
        availability: "missing",
        lastError: "File missing on recheck.",
      });
    }
  }
  return updates;
}

// Avoid unused import lint for createReadStream in this module if tree-shaken elsewhere.
void createReadStream;
