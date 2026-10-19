import { availableParallelism } from "node:os";
import { getPerformanceState, setPerformanceState, upsertRecording } from "./recordings-catalog.mjs";
import { probeLocalRecording, convertRecordingToCache } from "./recordings-probe.mjs";
import { resolvePlayablePath } from "./recordings-serve.mjs";
import { detectLocalAvailability } from "./recordings-inventory.mjs";
import { stat } from "node:fs/promises";

const PREPARE_CONCURRENCY = Math.min(2, Math.max(1, availableParallelism?.() || 2));

/**
 * Apply an acknowledged performance command from FloBama OS.
 * Returns a result object for command ACK.
 */
export async function applyPerformanceCommand(runtime, command) {
  const catalog = runtime.recordingsCatalog;
  const kind = command.kind;
  const payload = command.payload || {};

  try {
    switch (kind) {
      case "scan_recordings":
        runtime.pendingScan = true;
        return { status: "accepted", detail: "Scan queued." };

      case "set_recordings_root": {
        const { DEFAULT_DROPBOX_RELATIVE_ROOT, saveRecordingsSettings } = await import(
          "./recordings-paths.mjs"
        );
        const root = String(payload.recordingsRoot || "").trim();
        if (!root) return { status: "rejected", rejectReason: "recordingsRoot required." };
        const dropboxRelativeRoot = String(
          payload.dropboxRelativeRoot || DEFAULT_DROPBOX_RELATIVE_ROOT,
        ).trim();
        await saveRecordingsSettings({
          recordingsRoot: root,
          dropboxRelativeRoot,
          defaultTimezone: payload.timezone || "America/Chicago",
        });
        catalog.data.recordingsRoot = root;
        catalog.data.dropboxRelativeRoot = dropboxRelativeRoot;
        await setPerformanceState(catalog, {});
        runtime.pendingScan = true;
        return { status: "completed", detail: "Recordings root saved." };
      }

      case "prepare_recording": {
        const recordingId = payload.recordingId;
        if (!recordingId) return { status: "rejected", rejectReason: "recordingId required." };
        void prepareRecording(runtime, recordingId);
        return { status: "accepted", detail: "Prepare started." };
      }

      case "play_now":
        return playNow(runtime, payload);
      case "play_next":
        return playNext(runtime, payload);
      case "queue_add":
        return queueAdd(runtime, payload);
      case "queue_remove":
        return queueRemove(runtime, payload);
      case "queue_reorder":
        return queueReorder(runtime, payload);
      case "pause":
        return pausePlayback(runtime);
      case "resume":
        return resumePlayback(runtime);
      case "seek":
        return seekPlayback(runtime, payload);
      case "skip":
        return skipPlayback(runtime);
      case "set_audio_muted":
        return setAudioMuted(runtime, payload);
      case "stop_return_normal":
        return stopReturnNormal(runtime, payload);
      case "report_progress":
        // OS-originated progress is ignored; runner is authoritative.
        return { status: "completed", detail: "Ignored; runner is authoritative." };
      default:
        return { status: "rejected", rejectReason: `Unknown command kind: ${kind}` };
    }
  } catch (error) {
    return {
      status: "rejected",
      rejectReason: error instanceof Error ? error.message : String(error),
    };
  }
}

async function ensureQueueItem(payload) {
  const recordingId = payload.recordingId;
  if (!recordingId) throw new Error("recordingId required.");
  return {
    queueItemId: payload.queueItemId || cryptoRandomId(),
    recordingId,
    displayTitle: payload.displayTitle || null,
    addedAt: new Date().toISOString(),
  };
}

function cryptoRandomId() {
  return `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function enterPerformanceMode(runtime) {
  const perf = getPerformanceState(runtime.recordingsCatalog);
  if (perf.mode === "performance") return perf;
  return setPerformanceState(runtime.recordingsCatalog, {
    mode: "performance",
    priorWallRevision: runtime.manifestRevision || null,
    priorMode: runtime.manifest?.mode || "playlist",
    audioMuted: perf.audioMuted !== false ? true : perf.audioMuted,
  });
}

async function playNow(runtime, payload) {
  const item = await ensureQueueItem(payload);
  const playable = await resolvePlayablePath(runtime.recordingsCatalog, item.recordingId);
  if (!playable.ok) {
    return { status: "rejected", rejectReason: playable.error || "Not playable." };
  }
  await enterPerformanceMode(runtime);
  const perf = getPerformanceState(runtime.recordingsCatalog);
  const queue = [item, ...(perf.queue || []).filter((q) => q.queueItemId !== item.queueItemId)];
  const rec = runtime.recordingsCatalog.data.recordings[item.recordingId];
  await setPerformanceState(runtime.recordingsCatalog, {
    mode: "performance",
    queue,
    nowPlaying: {
      queueItemId: item.queueItemId,
      recordingId: item.recordingId,
      displayTitle: item.displayTitle || rec?.displayTitleOverride || rec?.originalFilename || item.recordingId,
      startedAt: new Date().toISOString(),
      positionSeconds: 0,
      durationSeconds: rec?.durationSeconds ?? null,
      paused: false,
      muted: true,
      status: "playing",
      url: `/recordings/${item.recordingId}/media`,
    },
    audioMuted: true,
    lastError: null,
  });
  bumpPerformancePlayback(runtime);
  return { status: "completed", detail: "Playing now." };
}

async function playNext(runtime, payload) {
  const item = await ensureQueueItem(payload);
  const perf = getPerformanceState(runtime.recordingsCatalog);
  const queue = [...(perf.queue || [])];
  if (perf.nowPlaying) {
    queue.splice(0, 0, item);
  } else {
    return playNow(runtime, payload);
  }
  await setPerformanceState(runtime.recordingsCatalog, { queue });
  return { status: "completed", detail: "Queued next." };
}

async function queueAdd(runtime, payload) {
  const item = await ensureQueueItem(payload);
  const perf = getPerformanceState(runtime.recordingsCatalog);
  const queue = [...(perf.queue || []), item];
  await setPerformanceState(runtime.recordingsCatalog, { queue });
  if (perf.mode !== "performance" || !perf.nowPlaying) {
    // Adding alone does not start playback unless play_now was used.
  }
  return { status: "completed", detail: "Added to queue." };
}

async function queueRemove(runtime, payload) {
  const id = payload.queueItemId;
  const perf = getPerformanceState(runtime.recordingsCatalog);
  const queue = (perf.queue || []).filter((q) => q.queueItemId !== id);
  let nowPlaying = perf.nowPlaying;
  if (nowPlaying?.queueItemId === id) {
    return skipPlayback(runtime);
  }
  await setPerformanceState(runtime.recordingsCatalog, { queue, nowPlaying });
  return { status: "completed", detail: "Removed." };
}

async function queueReorder(runtime, payload) {
  const order = Array.isArray(payload.queueItemIds) ? payload.queueItemIds : [];
  const perf = getPerformanceState(runtime.recordingsCatalog);
  const byId = new Map((perf.queue || []).map((q) => [q.queueItemId, q]));
  const queue = [];
  for (const id of order) {
    if (byId.has(id)) {
      queue.push(byId.get(id));
      byId.delete(id);
    }
  }
  for (const rest of byId.values()) queue.push(rest);
  await setPerformanceState(runtime.recordingsCatalog, { queue });
  return { status: "completed", detail: "Reordered." };
}

async function pausePlayback(runtime) {
  const perf = getPerformanceState(runtime.recordingsCatalog);
  if (!perf.nowPlaying) return { status: "rejected", rejectReason: "Nothing playing." };
  await setPerformanceState(runtime.recordingsCatalog, {
    nowPlaying: { ...perf.nowPlaying, paused: true, status: "paused" },
  });
  bumpPerformancePlayback(runtime);
  return { status: "completed" };
}

async function resumePlayback(runtime) {
  const perf = getPerformanceState(runtime.recordingsCatalog);
  if (!perf.nowPlaying) return { status: "rejected", rejectReason: "Nothing playing." };
  await setPerformanceState(runtime.recordingsCatalog, {
    nowPlaying: { ...perf.nowPlaying, paused: false, status: "playing" },
  });
  bumpPerformancePlayback(runtime);
  return { status: "completed" };
}

async function seekPlayback(runtime, payload) {
  const positionSeconds = Number(payload.positionSeconds);
  if (!Number.isFinite(positionSeconds) || positionSeconds < 0) {
    return { status: "rejected", rejectReason: "Invalid positionSeconds." };
  }
  const perf = getPerformanceState(runtime.recordingsCatalog);
  if (!perf.nowPlaying) return { status: "rejected", rejectReason: "Nothing playing." };
  await setPerformanceState(runtime.recordingsCatalog, {
    nowPlaying: { ...perf.nowPlaying, positionSeconds, seekToken: Date.now() },
  });
  bumpPerformancePlayback(runtime);
  return { status: "completed" };
}

async function skipPlayback(runtime) {
  const perf = getPerformanceState(runtime.recordingsCatalog);
  const queue = [...(perf.queue || [])];
  // Remove current from queue head if present
  if (perf.nowPlaying) {
    const idx = queue.findIndex((q) => q.queueItemId === perf.nowPlaying.queueItemId);
    if (idx >= 0) queue.splice(idx, 1);
  }
  if (!queue.length) {
    return stopReturnNormal(runtime, { reason: "queue_empty" });
  }
  const next = queue[0];
  return playNow(runtime, next);
}

async function setAudioMuted(runtime, payload) {
  const muted = payload.muted !== false;
  const perf = getPerformanceState(runtime.recordingsCatalog);
  await setPerformanceState(runtime.recordingsCatalog, {
    audioMuted: muted,
    nowPlaying: perf.nowPlaying ? { ...perf.nowPlaying, muted } : null,
  });
  bumpPerformancePlayback(runtime);
  return { status: "completed", detail: muted ? "Muted." : "Audio enabled." };
}

async function stopReturnNormal(runtime, payload = {}) {
  const perf = getPerformanceState(runtime.recordingsCatalog);
  // Do not override a newer operator command: if generation advanced, bail.
  if (payload.expectedRevision != null && Number(payload.expectedRevision) !== Number(perf.revision)) {
    return { status: "rejected", rejectReason: "Stale stop command; newer operator state exists." };
  }
  await setPerformanceState(runtime.recordingsCatalog, {
    mode: "normal",
    queue: [],
    nowPlaying: null,
    lastError: null,
    restoredAt: new Date().toISOString(),
  });
  bumpPerformancePlayback(runtime);
  return { status: "completed", detail: "Returned to normal wall." };
}

function bumpPerformancePlayback(runtime) {
  runtime.performanceRevision = (Number(runtime.performanceRevision) || 0) + 1;
}

/**
 * Player reports progress; runner remains authoritative source for OS sync.
 */
export async function reportLocalProgress(runtime, body) {
  const perf = getPerformanceState(runtime.recordingsCatalog);
  if (!perf.nowPlaying) return getPerformanceState(runtime.recordingsCatalog);
  if (body.queueItemId && body.queueItemId !== perf.nowPlaying.queueItemId) {
    return perf;
  }
  const patch = {
    ...perf.nowPlaying,
    positionSeconds: Number(body.positionSeconds) || perf.nowPlaying.positionSeconds,
    durationSeconds:
      body.durationSeconds != null ? Number(body.durationSeconds) : perf.nowPlaying.durationSeconds,
    paused: body.paused != null ? Boolean(body.paused) : perf.nowPlaying.paused,
    status: body.ended ? "ended" : body.paused ? "paused" : "playing",
  };
  await setPerformanceState(runtime.recordingsCatalog, { nowPlaying: patch });
  if (body.ended) {
    await skipPlayback(runtime);
  }
  if (body.error) {
    await setPerformanceState(runtime.recordingsCatalog, {
      lastError: String(body.error).slice(0, 500),
      nowPlaying: { ...patch, status: "error" },
    });
  }
  return getPerformanceState(runtime.recordingsCatalog);
}

const prepareInflight = new Map();

export async function prepareRecording(runtime, recordingId) {
  if (prepareInflight.has(recordingId)) return prepareInflight.get(recordingId);
  const job = (async () => {
    const catalog = runtime.recordingsCatalog;
    const rec = catalog.data.recordings[recordingId];
    if (!rec?.absolutePath && !rec?.relativePath) {
      return { ok: false, error: "Unknown recording." };
    }
    await upsertRecording(catalog, {
      recordingId,
      availability: "preparing",
      lastError: null,
    });

    // Recheck local bytes — we cannot invent Dropbox CLI hydration.
    const pathResult = await resolvePlayablePath(catalog, recordingId);
    if (!pathResult.ok) {
      await upsertRecording(catalog, {
        recordingId,
        availability: "needs download",
        lastError:
          "File is not fully local. In Dropbox, right-click the recording → Make available offline, then retry Prepare for Playback.",
      });
      return {
        ok: false,
        error: "needs_offline",
        instruction:
          "In Finder/Dropbox: right-click the file or folder → Make available offline. Then click Prepare for Playback again.",
      };
    }

    try {
      const info = await stat(pathResult.path);
      const local = await detectLocalAvailability(pathResult.path, info);
      if (local.availability === "needs download") {
        await upsertRecording(catalog, {
          recordingId,
          availability: "needs download",
          lastError: local.reason,
        });
        return { ok: false, error: "needs_offline", instruction: local.reason };
      }
      const probe = await probeLocalRecording(pathResult.path);
      if (!probe.ok) {
        await upsertRecording(catalog, {
          recordingId,
          availability: "error",
          lastError: probe.error,
        });
        return { ok: false, error: probe.error };
      }
      let availability = "ready";
      let convertedPath = null;
      if (probe.needsConversion) {
        await upsertRecording(catalog, {
          recordingId,
          availability: "preparing",
          lastError: "Converting for wall playback…",
        });
        const converted = await convertRecordingToCache(recordingId, pathResult.path);
        if (!converted.ok) {
          await upsertRecording(catalog, {
            recordingId,
            availability: "error",
            lastError: converted.error,
            needsConversion: true,
            playbackCompatible: false,
          });
          return { ok: false, error: converted.error };
        }
        convertedPath = converted.path;
      }
      await upsertRecording(catalog, {
        recordingId,
        availability,
        durationSeconds: probe.durationSeconds,
        container: probe.container,
        videoCodec: probe.videoCodec,
        audioCodec: probe.audioCodec,
        width: probe.width,
        height: probe.height,
        hasAudio: probe.hasAudio,
        playbackCompatible: probe.playbackCompatible,
        needsConversion: probe.needsConversion,
        probe,
        convertedPath,
        lastError: null,
        fileSize: info.size,
        mtimeMs: info.mtimeMs,
      });
      runtime.pendingCatalogSync = true;
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await upsertRecording(catalog, {
        recordingId,
        availability: "error",
        lastError: message,
      });
      return { ok: false, error: message };
    } finally {
      prepareInflight.delete(recordingId);
    }
  })();
  prepareInflight.set(recordingId, job);
  return job;
}

export function performancePlaybackPayload(runtime) {
  const perf = getPerformanceState(runtime.recordingsCatalog);
  if (perf.mode !== "performance" || !perf.nowPlaying) {
    return null;
  }
  return {
    mode: "performance",
    revision: `perf-${perf.revision}`,
    performanceRevision: perf.revision,
    startedAt: perf.nowPlaying.startedAt,
    playlistId: null,
    reloadNonce: runtime.reloadNonce,
    audioMuted: perf.audioMuted !== false,
    nowPlaying: perf.nowPlaying,
    queue: perf.queue,
    lastError: perf.lastError,
    items: [
      {
        id: perf.nowPlaying.queueItemId,
        sceneId: perf.nowPlaying.recordingId,
        kind: "performance",
        mediaKind: "video",
        url: `/recordings/${perf.nowPlaying.recordingId}/media`,
        obsSceneName: null,
        durationSeconds: perf.nowPlaying.durationSeconds || 0,
        displayTitle: perf.nowPlaying.displayTitle,
        muted: perf.audioMuted !== false,
        paused: Boolean(perf.nowPlaying.paused),
        positionSeconds: perf.nowPlaying.positionSeconds || 0,
        seekToken: perf.nowPlaying.seekToken || null,
      },
    ],
    playlist: [],
    active: {
      id: perf.nowPlaying.recordingId,
      title: perf.nowPlaying.displayTitle,
      url: `/recordings/${perf.nowPlaying.recordingId}/media`,
      mediaKind: "video",
    },
    apiBase: runtime.config?.apiBase || "",
  };
}

void PREPARE_CONCURRENCY;
