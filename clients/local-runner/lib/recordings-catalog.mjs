import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { RECORDINGS_CATALOG_FILE, PERFORMANCE_CACHE_DIR } from "./recordings-paths.mjs";

/** Local catalog of Dropbox recordings — never stores absolute paths in OS sync payloads. */

async function loadCatalog() {
  try {
    const raw = JSON.parse(await readFile(RECORDINGS_CATALOG_FILE, "utf8"));
    return {
      version: 1,
      recordingsRoot: raw.recordingsRoot || null,
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
      version: 1,
      recordingsRoot: null,
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

export async function mergeScanResults(catalog, { recordingsRoot, scanned, nonVideo, stats, preserveFields = ["manualLocked", "displayTitleOverride"] }) {
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

/** Metadata safe to sync to FloBama OS (no absolute paths). */
export function catalogSyncPayload(catalog, deviceId) {
  const recordings = listRecordings(catalog).map((rec) => ({
    recordingId: rec.recordingId,
    sourceDeviceId: deviceId || null,
    originalFilename: rec.originalFilename,
    relativePath: rec.relativePath,
    fileSize: rec.fileSize ?? null,
    birthtimeMs: rec.birthtimeMs ?? null,
    mtimeMs: rec.mtimeMs ?? null,
    parsedTimestamp: rec.parsedTimestamp ?? null,
    rawTimestampText: rec.rawTimestampText ?? null,
    timezone: rec.timezone ?? null,
    parseSource: rec.parseSource ?? null,
    parseConfidence: rec.parseConfidence ?? null,
    durationSeconds: rec.durationSeconds ?? null,
    container: rec.container ?? null,
    videoCodec: rec.videoCodec ?? null,
    audioCodec: rec.audioCodec ?? null,
    width: rec.width ?? null,
    height: rec.height ?? null,
    hasAudio: rec.hasAudio ?? null,
    availability: rec.availability,
    lastScanAt: rec.lastScanAt ?? null,
    lastError: rec.lastError ?? null,
    playbackCompatible: rec.playbackCompatible ?? null,
    needsConversion: rec.needsConversion ?? false,
  }));

  return {
    recordingsRootConfigured: Boolean(catalog.data.recordingsRoot),
    lastScanAt: catalog.data.lastScanAt,
    scanStats: catalog.data.scanStats,
    nonVideoCount: Array.isArray(catalog.data.nonVideo) ? catalog.data.nonVideo.length : 0,
    nonVideoSample: (catalog.data.nonVideo || []).slice(0, 50),
    recordings,
    performance: getPerformanceState(catalog),
  };
}
