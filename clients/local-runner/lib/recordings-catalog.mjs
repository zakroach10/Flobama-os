import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { RECORDINGS_CATALOG_FILE, PERFORMANCE_CACHE_DIR } from "./recordings-paths.mjs";

/** Local catalog of Dropbox recordings — never stores absolute paths in OS sync payloads. */

async function loadCatalog() {
  try {
    const raw = JSON.parse(await readFile(RECORDINGS_CATALOG_FILE, "utf8"));
    return {
      version: 2,
      recordingsRoot: raw.recordingsRoot || null,
      dropboxRelativeRoot: raw.dropboxRelativeRoot || null,
      lastScanAt: raw.lastScanAt || null,
      recordings: raw.recordings && typeof raw.recordings === "object" ? raw.recordings : {},
      nonVideo: Array.isArray(raw.nonVideo) ? raw.nonVideo : [],
      scanStats: raw.scanStats && typeof raw.scanStats === "object" ? raw.scanStats : {},
      prepareJobs: raw.prepareJobs && typeof raw.prepareJobs === "object" ? raw.prepareJobs : {},
      convertJobs: raw.convertJobs && typeof raw.convertJobs === "object" ? raw.convertJobs : {},
      performance: raw.performance && typeof raw.performance === "object" ? raw.performance : defaultPerformanceState(),
    };
  } catch {
    return {
      version: 2,
      recordingsRoot: null,
      dropboxRelativeRoot: null,
      lastScanAt: null,
      recordings: {},
      nonVideo: [],
      scanStats: {},
      prepareJobs: {},
      convertJobs: {},
      performance: defaultPerformanceState(),
    };
  }
}

export function defaultPerformanceState() {
  return {
    mode: "normal", // normal | performance
    priorWallRevision: null,
    priorMode: null,
    queue: [], // [{ queueItemId, recordingId, displayTitle, addedAt }]
    nowPlaying: null, // { queueItemId, recordingId, startedAt, positionSeconds, durationSeconds, paused, muted, status }
    audioMuted: true,
    lastError: null,
    revision: 1,
  };
}

export async function openRecordingsCatalog() {
  await mkdir(dirname(RECORDINGS_CATALOG_FILE), { recursive: true });
  await mkdir(PERFORMANCE_CACHE_DIR, { recursive: true });
  const data = await loadCatalog();
  return { file: RECORDINGS_CATALOG_FILE, data };
}

async function persist(catalog) {
  const tmp = `${catalog.file}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(catalog.data, null, 2)}\n`, "utf8");
  await rename(tmp, catalog.file);
}

export async function saveCatalog(catalog) {
  await persist(catalog);
}

export function getRecording(catalog, recordingId) {
  return catalog.data.recordings[recordingId] ?? null;
}

export function listRecordings(catalog) {
  return Object.values(catalog.data.recordings);
}

export async function upsertRecording(catalog, recording) {
  const existing = catalog.data.recordings[recording.recordingId] || {};
  // Preserve manual match locks / titles that live in OS — local catalog only keeps local fields.
  catalog.data.recordings[recording.recordingId] = {
    ...existing,
    ...recording,
    updatedAt: new Date().toISOString(),
  };
  await persist(catalog);
  return catalog.data.recordings[recording.recordingId];
}

export async function mergeScanResults(catalog, {
  recordingsRoot,
  dropboxRelativeRoot = null,
  scanned,
  nonVideo,
  stats,
  preserveFields = ["manualLocked", "displayTitleOverride"],
}) {
  const now = new Date().toISOString();
  const seen = new Set();
  const preserve = preserveFields;

  for (const item of scanned) {
    seen.add(item.recordingId);
    const prior = catalog.data.recordings[item.recordingId] || {};
    const next = { ...item, lastScanAt: now };
    for (const key of preserve) {
      if (prior[key] !== undefined) next[key] = prior[key];
    }
    // Do not clobber a ready probe with a metadata-only re-scan of the same inode signature.
    if (
      prior.availability === "ready" &&
      prior.fileSize === item.fileSize &&
      prior.mtimeMs === item.mtimeMs &&
      item.availability === "metadata-only" &&
      prior.probe
    ) {
      next.availability = "ready";
      next.probe = prior.probe;
      next.durationSeconds = prior.durationSeconds;
      next.container = prior.container;
      next.videoCodec = prior.videoCodec;
      next.audioCodec = prior.audioCodec;
      next.width = prior.width;
      next.height = prior.height;
      next.hasAudio = prior.hasAudio;
    }
    catalog.data.recordings[item.recordingId] = {
      ...prior,
      ...next,
      updatedAt: now,
    };
  }

  for (const [id, prior] of Object.entries(catalog.data.recordings)) {
    if (seen.has(id)) continue;
    if (prior.availability === "missing") continue;
    catalog.data.recordings[id] = {
      ...prior,
      availability: "missing",
      lastScanAt: now,
      lastError: "File not found on last scan.",
      updatedAt: now,
    };
  }

  catalog.data.recordingsRoot = recordingsRoot;
  if (dropboxRelativeRoot) catalog.data.dropboxRelativeRoot = dropboxRelativeRoot;
  catalog.data.lastScanAt = now;
  catalog.data.nonVideo = nonVideo;
  catalog.data.scanStats = stats;
  await persist(catalog);
  return catalog.data;
}

export async function setPerformanceState(catalog, patch) {
  catalog.data.performance = {
    ...catalog.data.performance,
    ...patch,
    revision: (Number(catalog.data.performance?.revision) || 1) + 1,
  };
  await persist(catalog);
  return catalog.data.performance;
}

export function getPerformanceState(catalog) {
  return catalog.data.performance || defaultPerformanceState();
}

function asIsoOrNull(value) {
  if (value == null || value === "") return null;
  const s = String(value);
  const ms = Date.parse(s);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function asFiniteNumberOrNull(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Metadata safe to sync to FloBama OS (no absolute paths). */
export function catalogSyncPayload(catalog, deviceId) {
  const sourceDeviceId =
    typeof deviceId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deviceId)
      ? deviceId
      : null;

  const recordings = listRecordings(catalog)
    .filter((rec) => rec && rec.recordingId && rec.originalFilename && rec.relativePath)
    .filter((rec) => rec.availability !== "missing")
    .map((rec) => ({
      recordingId: String(rec.recordingId).slice(0, 64),
      sourceDeviceId,
      originalFilename: String(rec.originalFilename).slice(0, 500),
      relativePath: String(rec.relativePath).slice(0, 2000),
      sessionFolder: rec.sessionFolder != null ? String(rec.sessionFolder).slice(0, 500) : null,
      sessionRelativePath:
        rec.sessionRelativePath != null ? String(rec.sessionRelativePath).slice(0, 2000) : null,
      fileSize: asFiniteNumberOrNull(rec.fileSize),
      birthtimeMs: asFiniteNumberOrNull(rec.birthtimeMs),
      mtimeMs: asFiniteNumberOrNull(rec.mtimeMs),
      parsedTimestamp: asIsoOrNull(rec.parsedTimestamp),
      rawTimestampText: rec.rawTimestampText != null ? String(rec.rawTimestampText).slice(0, 200) : null,
      timezone: rec.timezone != null ? String(rec.timezone).slice(0, 80) : null,
      parseSource: rec.parseSource != null ? String(rec.parseSource).slice(0, 80) : null,
      parseConfidence: rec.parseConfidence != null ? String(rec.parseConfidence).slice(0, 40) : null,
      durationSeconds: asFiniteNumberOrNull(rec.durationSeconds),
      container: rec.container != null ? String(rec.container).slice(0, 80) : null,
      videoCodec: rec.videoCodec != null ? String(rec.videoCodec).slice(0, 80) : null,
      audioCodec: rec.audioCodec != null ? String(rec.audioCodec).slice(0, 80) : null,
      width: asFiniteNumberOrNull(rec.width) != null ? Math.trunc(Number(rec.width)) : null,
      height: asFiniteNumberOrNull(rec.height) != null ? Math.trunc(Number(rec.height)) : null,
      hasAudio: typeof rec.hasAudio === "boolean" ? rec.hasAudio : null,
      availability: rec.availability || "error",
      lastScanAt: asIsoOrNull(rec.lastScanAt),
      lastError: rec.lastError != null ? String(rec.lastError).slice(0, 1000) : null,
      playbackCompatible: typeof rec.playbackCompatible === "boolean" ? rec.playbackCompatible : null,
      needsConversion: Boolean(rec.needsConversion),
      cameraCount: asFiniteNumberOrNull(rec.cameraCount),
      primaryAssetId: rec.primaryAssetId != null ? String(rec.primaryAssetId).slice(0, 64) : null,
      assets: Array.isArray(rec.assets)
        ? rec.assets.slice(0, 64).map((asset) => ({
            assetId: String(asset.assetId || "").slice(0, 64),
            role: ["primary", "camera", "other"].includes(asset.role) ? asset.role : "other",
            originalFilename: String(asset.originalFilename || "").slice(0, 500),
            relativePath: String(asset.relativePath || "").slice(0, 2000),
            fileSize: asFiniteNumberOrNull(asset.fileSize),
            availability: asset.availability || "error",
            lastError: asset.lastError != null ? String(asset.lastError).slice(0, 500) : null,
          }))
        : [],
    }));

  return {
    recordingsRootConfigured: Boolean(catalog.data.recordingsRoot),
    recordingsRoot: catalog.data.recordingsRoot || null,
    dropboxRelativeRoot: catalog.data.dropboxRelativeRoot || null,
    lastScanAt: asIsoOrNull(catalog.data.lastScanAt),
    scanStats: catalog.data.scanStats || {},
    nonVideoCount: Array.isArray(catalog.data.nonVideo) ? catalog.data.nonVideo.length : 0,
    nonVideoSample: (catalog.data.nonVideo || []).slice(0, 50).map((row) => ({
      originalFilename: row?.originalFilename ?? null,
      relativePath: row?.relativePath ?? null,
      reason: row?.reason ?? null,
    })),
    recordings,
    performance: getPerformanceState(catalog),
  };
}
