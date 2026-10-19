import { availableParallelism } from "node:os";
import {
  clampAudioVolume,
  getPerformanceState,
  setPerformanceState,
  upsertRecording,
} from "./recordings-catalog.mjs";
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
      case "set_audio_volume":
        return setAudioVolume(runtime, payload);
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
    // Keep operator mute/volume preference when entering performance mode.
    audioMuted: Boolean(perf.audioMuted),
    audioVolume: clampAudioVolume(perf.audioVolume, 1),
  });
}

async function playNow(runtime, payload) {
  const item = await ensureQueueItem(payload);
  const playable = await resolvePlayablePath(runtime.recordingsCatalog, item.recordingId);
  if (!playable.ok) {
    const reason = playable.error || "Not playable.";
    await setPerformanceState(runtime.recordingsCatalog, { lastError: reason });
    bumpPerformancePlayback(runtime);
    return { status: "rejected", rejectReason: reason };
  }
  // Prefer the catalog session id (may differ from a legacy file-path id in the command).
  const catalogRecordingId = playable.recordingId || item.recordingId;
  const playItem = { ...item, recordingId: catalogRecordingId };
  await enterPerformanceMode(runtime);
  const perf = getPerformanceState(runtime.recordingsCatalog);
  const queue = [playItem, ...(perf.queue || []).filter((q) => q.queueItemId !== playItem.queueItemId)];
  const rec = playable.recording || runtime.recordingsCatalog.data.recordings[catalogRecordingId];
  // Always start playback with audio on; staff can mute/adjust from Server Station.
  const audioVolume = clampAudioVolume(perf.audioVolume, 1) || 1;
  await setPerformanceState(runtime.recordingsCatalog, {
    mode: "performance",
    queue,
    nowPlaying: {
      queueItemId: playItem.queueItemId,
      recordingId: catalogRecordingId,
      displayTitle:
        playItem.displayTitle || rec?.displayTitleOverride || rec?.originalFilename || catalogRecordingId,
      startedAt: new Date().toISOString(),
      positionSeconds: 0,
      durationSeconds: rec?.durationSeconds ?? null,
      paused: false,
      muted: false,
      volume: audioVolume,
      status: "playing",
      url: `/recordings/${catalogRecordingId}/media`,
    },
    audioMuted: false,
    audioVolume,
    lastError: null,
  });
  bumpPerformancePlayback(runtime);
  return { status: "completed", detail: "Playing now with audio." };
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
  const perf = getPerformanceState(runtime.recordingsCatalog);
  if (!perf.nowPlaying) return { status: "rejected", rejectReason: "Nothing playing." };

  let positionSeconds;
  const delta = Number(payload.deltaSeconds);
  if (Number.isFinite(delta)) {
    const current = Number(perf.nowPlaying.positionSeconds) || 0;
    positionSeconds = Math.max(0, current + delta);
  } else {
    positionSeconds = Number(payload.positionSeconds);
  }
  if (!Number.isFinite(positionSeconds) || positionSeconds < 0) {
    return { status: "rejected", rejectReason: "Invalid positionSeconds or deltaSeconds." };
  }

  const duration = Number(perf.nowPlaying.durationSeconds);
  if (Number.isFinite(duration) && duration > 0) {
    // Keep a small cushion so we don't immediately fire "ended".
    positionSeconds = Math.min(positionSeconds, Math.max(0, duration - 0.25));
  }

  await setPerformanceState(runtime.recordingsCatalog, {
    nowPlaying: { ...perf.nowPlaying, positionSeconds, seekToken: Date.now() },
  });
  bumpPerformancePlayback(runtime);
  return {
    status: "completed",
    detail: Number.isFinite(delta)
      ? `Seeked ${delta >= 0 ? "+" : ""}${Math.round(delta)}s → ${Math.floor(positionSeconds)}s.`
      : `Seeked to ${Math.floor(positionSeconds)}s.`,
  };
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
  const volume =
    payload.volume != null ? clampAudioVolume(payload.volume, perf.audioVolume ?? 1) : clampAudioVolume(perf.audioVolume, 1);
  await setPerformanceState(runtime.recordingsCatalog, {
    audioMuted: muted,
    audioVolume: volume,
    nowPlaying: perf.nowPlaying ? { ...perf.nowPlaying, muted, volume } : null,
  });
  bumpPerformancePlayback(runtime);
  return { status: "completed", detail: muted ? "Muted." : "Audio enabled." };
}

async function setAudioVolume(runtime, payload) {
  const perf = getPerformanceState(runtime.recordingsCatalog);
  const raw = Number(payload.volume);
  if (!Number.isFinite(raw)) {
    return { status: "rejected", rejectReason: "volume must be a number from 0 to 1." };
  }
  const volume = clampAudioVolume(raw, 0);
  // volume 0 → mute but keep prior level for restore; volume > 0 → unmute at that level.
  if (volume <= 0) {
    const kept = clampAudioVolume(perf.audioVolume, 1) || 1;
    await setPerformanceState(runtime.recordingsCatalog, {
      audioMuted: true,
      audioVolume: kept,
      nowPlaying: perf.nowPlaying ? { ...perf.nowPlaying, muted: true, volume: kept } : null,
    });
    bumpPerformancePlayback(runtime);
    return { status: "completed", detail: "Muted." };
  }
  const muted = payload.muted === true;
  await setPerformanceState(runtime.recordingsCatalog, {
    audioMuted: muted,
    audioVolume: volume,
    nowPlaying: perf.nowPlaying ? { ...perf.nowPlaying, muted, volume } : null,
  });
  bumpPerformancePlayback(runtime);
  return { status: "completed", detail: muted ? `Muted at ${Math.round(volume * 100)}%.` : `Volume ${Math.round(volume * 100)}%.` };
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
  const audioMuted = Boolean(perf.audioMuted);
  const audioVolume = clampAudioVolume(perf.audioVolume, 1);
  return {
    mode: "performance",
    revision: `perf-${perf.revision}`,
    performanceRevision: perf.revision,
    startedAt: perf.nowPlaying.startedAt,
    playlistId: null,
    reloadNonce: runtime.reloadNonce,
    audioMuted,
    audioVolume,
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
        muted: audioMuted,
        volume: audioVolume,
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
