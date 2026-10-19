import { createReadStream } from "node:fs";
import { open, readdir, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import {
  classifySessionVideo,
  isIgnoredDirName,
  parseEcammSessionFolderName,
  parseSessionFolderTimestamp,
} from "./recordings-ecamm.mjs";
import { relativeFromRoot, stableRecordingId } from "./recordings-paths.mjs";

const GROWING_WINDOW_MS = 15_000;
const BATCH_DEFAULT = 200;

/**
 * Detect online-only / cloud placeholders without hydrating.
 * Conservative: never force Dropbox to download during inventory.
 */
export async function detectLocalAvailability(filePath, info) {
  if (!info.size) {
    return { availability: "needs download", reason: "File size is 0 (likely online-only or empty)." };
  }

  const ageMs = Date.now() - info.mtimeMs;
  if (ageMs >= 0 && ageMs < GROWING_WINDOW_MS) {
    return { availability: "preparing", reason: "File was modified within the last 15s — may still be recording." };
  }

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

async function inventorySessionAsset(recordingsRoot, sessionFolderName, entryName, fullPath) {
  const role = classifySessionVideo(sessionFolderName, entryName);
  if (!role) return null;

  const rel = relativeFromRoot(recordingsRoot, fullPath);
  if (!rel) return null;

  let info;
  try {
    info = await stat(fullPath);
  } catch (error) {
    return {
      assetId: stableRecordingId(rel),
      role,
      originalFilename: entryName,
      relativePath: rel,
      fileSize: null,
      availability: "error",
      lastError: error instanceof Error ? error.message : "stat failed",
      extension: extname(entryName).toLowerCase(),
      mtimeMs: null,
      birthtimeMs: null,
    };
  }

  const local = await detectLocalAvailability(fullPath, info);
  return {
    assetId: stableRecordingId(rel),
    role,
    originalFilename: entryName,
    relativePath: rel,
    absolutePath: fullPath,
    fileSize: info.size,
    birthtimeMs: info.birthtimeMs || null,
    mtimeMs: info.mtimeMs || null,
    blocks: info.blocks ?? null,
    extension: extname(entryName).toLowerCase(),
    availability: local.availability === "metadata-only" ? "ready" : local.availability,
    lastError: local.reason,
  };
}

/**
 * Inventory one Ecamm session folder: primary + camera (+ other) assets.
 * Session id is derived from the folder relative path, never filename alone.
 */
export async function inventoryEcammSession(recordingsRoot, sessionDir, sessionFolderName, options = {}) {
  const timeZone = options.timeZone || "America/Chicago";
  const sessionRel = relativeFromRoot(recordingsRoot, sessionDir);
  if (!sessionRel) return null;

  const parsed = parseSessionFolderTimestamp(sessionFolderName, timeZone);
  let entries;
  try {
    entries = await readdir(sessionDir, { withFileTypes: true });
  } catch (error) {
    return {
      recordingId: stableRecordingId(sessionRel),
      sessionFolder: sessionFolderName,
      sessionRelativePath: sessionRel,
      originalFilename: sessionFolderName,
      relativePath: sessionRel,
      absolutePath: sessionDir,
      assets: [],
      parsedTimestamp: parsed.ok ? parsed.parsedTimestamp : null,
      rawTimestampText: parsed.rawTimestampText,
      timezone: timeZone,
      parseSource: parsed.parseSource,
      parseConfidence: parsed.parseConfidence,
      parseError: parsed.ok ? null : parsed.error || null,
      ambiguousDst: Boolean(parsed.ambiguousDst),
      availability: "error",
      lastError: error instanceof Error ? error.message : "Could not read session folder.",
      fileSize: null,
      primaryAssetId: null,
      cameraCount: 0,
    };
  }

  const assets = [];
  for (const entry of entries) {
    if (isIgnoredDirName(entry.name)) continue;
    if (entry.isDirectory() || entry.isSymbolicLink()) continue;
    if (!entry.isFile()) continue;
    const full = join(sessionDir, entry.name);
    const asset = await inventorySessionAsset(recordingsRoot, sessionFolderName, entry.name, full);
    if (asset) assets.push(asset);
  }

  // Stable order: primary first, then cameras, then other — by filename within role.
  const roleRank = { primary: 0, camera: 1, other: 2 };
  assets.sort((a, b) => {
    const rank = (roleRank[a.role] ?? 9) - (roleRank[b.role] ?? 9);
    if (rank !== 0) return rank;
    return String(a.originalFilename).localeCompare(String(b.originalFilename));
  });

  const namedPrimary = assets.find((a) => a.role === "primary") || null;
  const cameras = assets.filter((a) => a.role === "camera");
  const others = assets.filter((a) => a.role === "other");
  // Exact folder-name primary wins; otherwise a single non-camera video can stand in for playback.
  let primary = namedPrimary;
  if (!primary && others.length === 1) {
    primary = { ...others[0], role: "primary" };
    const idx = assets.findIndex((a) => a.assetId === others[0].assetId);
    if (idx >= 0) assets[idx] = primary;
  }

  // Playback path: primary file when present; otherwise session folder (unplayable until primary exists).
  const playbackRel = primary?.relativePath || sessionRel;
  const playbackAbs = primary?.absolutePath || sessionDir;

  let availability = primary?.availability || "error";
  let lastError = primary?.lastError || null;
  if (!primary) {
    if (cameras.length || others.length) {
      availability = "needs download";
      lastError = `No primary “${sessionFolderName}.mp4” yet (${cameras.length} camera, ${others.length} other). Make the main Ecamm file available offline, then rescan.`;
    } else {
      availability = "error";
      lastError = "Session folder has no playable video files.";
    }
  }

  return {
    recordingId: stableRecordingId(sessionRel),
    sessionFolder: sessionFolderName,
    sessionRelativePath: sessionRel,
    originalFilename: primary?.originalFilename || sessionFolderName,
    relativePath: playbackRel,
    absolutePath: playbackAbs,
    fileSize: primary?.fileSize ?? null,
    birthtimeMs: primary?.birthtimeMs ?? null,
    mtimeMs: primary?.mtimeMs ?? null,
    blocks: primary?.blocks ?? null,
    extension: primary?.extension || null,
    assets: assets.map(({ absolutePath: _abs, blocks: _blocks, ...rest }) => rest),
    primaryAssetId: primary?.assetId || null,
    cameraCount: cameras.length,
    parsedTimestamp: parsed.ok ? parsed.parsedTimestamp : null,
    rawTimestampText: parsed.rawTimestampText,
    timezone: parsed.timezone || timeZone,
    parseSource: parsed.parseSource,
    parseConfidence: parsed.parseConfidence,
    parseDateOnly: false,
    parseError: parsed.ok ? null : parsed.error || null,
    ambiguousDst: Boolean(parsed.ambiguousDst),
    availability,
    lastError,
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
}

/**
 * Session-folder inventory under the configured FloBama Recordings root.
 * Only direct children matching “Ecamm Recording on YYYY-MM-DD at HH.mm.ss” are sessions.
 * Ignores .inProgress.nosync and other hidden/sync placeholders.
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
  let sessionFolders = 0;
  let skippedIgnoredDirs = 0;
  let skippedNonSessionDirs = 0;
  let cameraAssets = 0;
  let errorCount = 0;

  let entries;
  try {
    entries = await readdir(recordingsRoot, { withFileTypes: true });
  } catch (error) {
    return {
      scanned: [],
      nonVideo: [
        {
          relativePath: ".",
          originalFilename: recordingsRoot,
          reason: error instanceof Error ? error.message : "Could not read recordings root.",
        },
      ],
      unsupported: [],
      stats: {
        totalFiles: 0,
        videoFiles: 0,
        sessionFolders: 0,
        skippedIgnoredDirs: 0,
        skippedNonSessionDirs: 0,
        cameraAssets: 0,
        nonVideoFiles: 1,
        unsupportedFiles: 0,
        errorCount: 1,
        scannedAt: new Date().toISOString(),
      },
    };
  }

  let batch = [];

  for (const entry of entries) {
    if (isIgnoredDirName(entry.name)) {
      skippedIgnoredDirs += 1;
      continue;
    }

    const full = join(recordingsRoot, entry.name);

    if (entry.isFile()) {
      totalFiles += 1;
      nonVideo.push({
        relativePath: entry.name,
        originalFilename: entry.name,
        reason: "Loose file at Recordings root — FloBama expects Ecamm session folders only.",
      });
      continue;
    }

    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;

    if (!parseEcammSessionFolderName(entry.name)) {
      skippedNonSessionDirs += 1;
      nonVideo.push({
        relativePath: entry.name,
        originalFilename: entry.name,
        reason: "Not an Ecamm session folder (expected “Ecamm Recording on YYYY-MM-DD at HH.mm.ss”).",
      });
      continue;
    }

    sessionFolders += 1;
    const session = await inventoryEcammSession(recordingsRoot, full, entry.name, { timeZone });
    if (!session) {
      errorCount += 1;
      continue;
    }

    totalFiles += session.assets.length;
    videoFiles += session.assets.length;
    cameraAssets += session.cameraCount;

    scanned.push(session);
    batch.push(session);
    if (batch.length >= batchSize) {
      if (onBatch) await onBatch(batch);
      batch = [];
    }
  }

  if (batch.length && onBatch) await onBatch(batch);

  const stats = {
    totalFiles,
    videoFiles,
    sessionFolders,
    skippedIgnoredDirs,
    skippedNonSessionDirs,
    cameraAssets,
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
    sessionFolder: rec.sessionFolder || null,
    sessionRelativePath: rec.sessionRelativePath || null,
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
    cameraCount: rec.cameraCount ?? (Array.isArray(rec.assets) ? rec.assets.filter((a) => a.role === "camera").length : 0),
    assets: Array.isArray(rec.assets)
      ? rec.assets.map((a) => ({
          assetId: a.assetId,
          role: a.role,
          originalFilename: a.originalFilename,
          relativePath: a.relativePath,
          fileSize: a.fileSize,
          availability: a.availability,
        }))
      : [],
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
    "sessionFolder",
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
    "cameraCount",
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

void createReadStream;
