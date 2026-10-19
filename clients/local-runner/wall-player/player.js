/* FloBama local wall player — media from localhost cache; overlays from FloBama APIs.
 * Performance mode: full videos advance on ended/skip — never forced through ad slot timers.
 */

// Keep in sync with resolveLedPlaylistStartedAt in src/lib/screens/led-playlists.ts.
function ledPlaylistIndexAt(items, startedAt, now = Date.now()) {
  if (!items.length) return 0;
  const startMs = startedAt ? Date.parse(startedAt) : now;
  if (!Number.isFinite(startMs)) return 0;
  const cycleSeconds = items.reduce((sum, item) => sum + Math.max(1, item.durationSeconds || 1), 0);
  if (cycleSeconds <= 0) return 0;
  let elapsed = Math.max(0, (now - startMs) / 1000) % cycleSeconds;
  for (let index = 0; index < items.length; index += 1) {
    elapsed -= Math.max(1, items[index].durationSeconds || 1);
    if (elapsed < 0) return index;
  }
  return 0;
}

function ledPlaylistPosition(items, startedAt, now = Date.now()) {
  if (!items.length) return { index: 0, elapsedSeconds: 0, remainingSeconds: 0 };
  const index = ledPlaylistIndexAt(items, startedAt, now);
  const startMs = startedAt ? Date.parse(startedAt) : now;
  const cycleSeconds = items.reduce((sum, item) => sum + Math.max(1, item.durationSeconds || 1), 0);
  let elapsed = 0;
  if (cycleSeconds > 0 && Number.isFinite(startMs)) {
    elapsed = Math.max(0, (now - startMs) / 1000) % cycleSeconds;
  }
  for (let cursor = 0; cursor < index; cursor += 1) {
    elapsed -= Math.max(1, items[cursor].durationSeconds || 1);
  }
  const duration = Math.max(1, items[index]?.durationSeconds || 1);
  const elapsedSeconds = Math.min(duration, Math.max(0, elapsed));
  return { index, elapsedSeconds, remainingSeconds: Math.max(0, duration - elapsedSeconds) };
}

function rebaseLedPlaylistStartedAt(items, index, elapsedSeconds, now = Date.now()) {
  if (!items.length) return new Date(now).toISOString();
  const safeIndex = ((index % items.length) + items.length) % items.length;
  let prefix = 0;
  for (let cursor = 0; cursor < safeIndex; cursor += 1) {
    prefix += Math.max(1, items[cursor].durationSeconds || 1);
  }
  const duration = Math.max(1, items[safeIndex].durationSeconds || 1);
  const elapsed = Math.min(Math.max(0, elapsedSeconds), Math.max(0, duration - 0.05));
  return new Date(now - (prefix + elapsed) * 1000).toISOString();
}

function membershipEqual(left, right) {
  if (left.length !== right.length) return false;
  return left.every(
    (item, index) => item.id === right[index]?.id && (item.durationSeconds || 1) === (right[index]?.durationSeconds || 1),
  );
}

function preserveLedPlaylistStartedAt(previous, previousStartedAt, next, now = Date.now()) {
  if (!previous.length || !next.length) return null;
  const position = ledPlaylistPosition(previous, previousStartedAt, now);
  const currentId = previous[position.index]?.id;
  if (!currentId) return null;
  const nextIndex = next.findIndex((item) => item.id === currentId);
  if (nextIndex < 0) return null;
  return rebaseLedPlaylistStartedAt(next, nextIndex, position.elapsedSeconds, now);
}

function isFreshPlaylistStart(startedAt, now) {
  const startedMs = Date.parse(startedAt);
  if (!Number.isFinite(startedMs)) return false;
  const age = now - startedMs;
  return age >= -2000 && age < 5000;
}

function resolveLedPlaylistStartedAt(previous, previousStartedAt, next, nextStartedAt, now = Date.now()) {
  if (!next.length) return nextStartedAt;
  if (!previous.length || !previousStartedAt) return nextStartedAt;
  if (nextStartedAt && nextStartedAt !== previousStartedAt && isFreshPlaylistStart(nextStartedAt, now)) {
    return nextStartedAt;
  }
  if (membershipEqual(previous, next)) {
    const local = ledPlaylistPosition(previous, previousStartedAt, now);
    const localId = previous[local.index]?.id;
    const serverIndex = nextStartedAt ? ledPlaylistIndexAt(next, nextStartedAt, now) : local.index;
    const serverId = next[serverIndex]?.id;
    if (localId && serverId && localId !== serverId && local.remainingSeconds > 0.25) return previousStartedAt;
    if (localId && localId === serverId) return previousStartedAt;
    return nextStartedAt || previousStartedAt;
  }
  return preserveLedPlaylistStartedAt(previous, previousStartedAt, next, now) || nextStartedAt;
}

const stage = document.getElementById("stage");
let revision = "";
/** null until first /api/playback poll — never assume 1 (venue nonce is often higher). */
let reloadNonce = null;
let mode = "idle";
let playlist = [];
let startedAt = null;
let index = 0;
let apiBase = "";
let trivia = null;
let audience = null;
/** Tracks url readiness so we re-render when cache finishes under the same revision. */
let playlistReadyKey = "";
let heldMedia = null;

/** Performance-mode state (authoritative controls come from /api/playback). */
let performanceItem = null;
let performanceSeekToken = null;
let performanceVideo = null;
let lastProgressPost = 0;

function playlistSignature(items) {
  return (items || [])
    .map((item) => `${item.id || ""}:${item.url || ""}:${item.kind || ""}:${item.mediaKind || ""}`)
    .join("|");
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function clearStage() {
  stage.replaceChildren();
  performanceVideo = null;
}

function renderBlack() {
  renderHoldCard();
}

function chooseVisibleItem(items, index, held) {
  const current = items?.[index] ?? items?.[0] ?? null;
  if (current?.url) return current;
  const ready = (items || []).find((item) => item?.url);
  if (ready) return ready;
  if (held?.url) return held;
  return null;
}

function renderHoldCard() {
  clearStage();
  const card = document.createElement("div");
  card.dataset.hold = "1";
  card.style.cssText =
    "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at top,#3a241c 0%,#100e0c 70%);color:#f7efe6;font:700 4rem system-ui,sans-serif;letter-spacing:0.14em";
  card.textContent = "FLOBAMA";
  stage.appendChild(card);
}

function renderMedia(item, { loop = true } = {}) {
  clearStage();
  if (!item?.url) {
    renderBlack();
    return;
  }
  if (item.mediaKind === "video") {
    const video = document.createElement("video");
    video.src = item.url;
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.loop = loop;
    video.preload = "auto";
    stage.appendChild(video);
    void video.play().catch(() => {});
    return;
  }
  const img = document.createElement("img");
  img.src = item.url;
  img.alt = "";
  stage.appendChild(img);
}

function clampVolume(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/** Apply mute + volume for performance playback (audio on by default). */
function applyPerformanceAudio(video, item) {
  if (!video) return;
  const muted = Boolean(item?.muted);
  const volume = clampVolume(item?.volume);
  video.muted = muted;
  try {
    video.volume = volume;
  } catch {
    /* ignore */
  }
}

function postPerformanceProgress(payload) {
  const now = Date.now();
  if (!payload.ended && !payload.error && now - lastProgressPost < 900) return;
  lastProgressPost = now;
  void fetch("/api/performance/progress", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

function renderPerformance(item) {
  if (!item?.url) {
    renderHoldCard();
    return;
  }

  const sameUrl = performanceVideo && performanceItem?.url === item.url && performanceVideo.isConnected;
  if (sameUrl) {
    applyPerformanceAudio(performanceVideo, item);
    if (item.paused) {
      performanceVideo.pause();
    } else if (performanceVideo.paused) {
      void performanceVideo.play().catch(() => {});
    }
    if (item.seekToken && item.seekToken !== performanceSeekToken) {
      performanceSeekToken = item.seekToken;
      const target = Number(item.positionSeconds) || 0;
      try {
        performanceVideo.currentTime = target;
      } catch {
        /* ignore */
      }
    }
    performanceItem = item;
    return;
  }

  clearStage();
  performanceItem = item;
  performanceSeekToken = item.seekToken || null;
  const video = document.createElement("video");
  video.src = item.url;
  video.autoplay = true;
  applyPerformanceAudio(video, item);
  video.playsInline = true;
  video.loop = false;
  video.preload = "auto";
  video.dataset.performance = "1";

  video.addEventListener("ended", () => {
    postPerformanceProgress({
      queueItemId: item.id,
      recordingId: item.sceneId,
      positionSeconds: video.currentTime || 0,
      durationSeconds: video.duration || item.durationSeconds || null,
      ended: true,
    });
  });
  video.addEventListener("error", () => {
    postPerformanceProgress({
      queueItemId: item.id,
      recordingId: item.sceneId,
      positionSeconds: video.currentTime || 0,
      error: "Video playback error.",
    });
  });
  video.addEventListener("timeupdate", () => {
    postPerformanceProgress({
      queueItemId: item.id,
      recordingId: item.sceneId,
      positionSeconds: video.currentTime || 0,
      durationSeconds: Number.isFinite(video.duration) ? video.duration : item.durationSeconds || null,
      paused: video.paused,
    });
  });

  stage.appendChild(video);
  performanceVideo = video;
  if (item.positionSeconds > 1) {
    const seekTo = Number(item.positionSeconds) || 0;
    video.addEventListener(
      "loadedmetadata",
      () => {
        try {
          video.currentTime = seekTo;
        } catch {
          /* ignore */
        }
      },
      { once: true },
    );
  }
  if (item.paused) {
    video.pause();
  } else {
    void video.play().catch(() => {});
  }
}

function renderPlaylist() {
  const visible = chooseVisibleItem(playlist, index, heldMedia);
  if (!visible?.url) {
    if (stage.querySelector("[data-hold]")) return;
    renderHoldCard();
    return;
  }
  heldMedia = visible;
  renderMedia(visible, { loop: playlist.length <= 1 });
}

function render() {
  if (mode === "performance") {
    // Performance takes priority over trivia/audience overlays on the local wall player.
    const item = performanceItem || playlist[0] || null;
    renderPerformance(item);
    return;
  }
  if (trivia || audience?.tool) {
    // Overlay UIs are hosted; show black under OBS scene that still hosts overlays, or keep media.
    // Local player keeps last media; trivia/audience preferably use hosted /display/led during those modes.
    return;
  }
  if (mode === "playlist" && playlist.length) {
    renderPlaylist();
    return;
  }
  const active = chooseVisibleItem(playlist, 0, heldMedia);
  if (active?.url) {
    heldMedia = active;
    renderMedia(active, { loop: true });
    return;
  }
  if (stage.querySelector("[data-hold]")) return;
  renderHoldCard();
}

async function refreshOverlays() {
  if (!apiBase) return;
  if (mode === "performance") return;
  try {
    const [triviaRes, audienceRes] = await Promise.all([
      fetchJson(`${apiBase}/api/public/v1/trivia/wall`),
      fetchJson(`${apiBase}/api/public/v1/audience/wall`),
    ]);
    trivia = triviaRes.trivia ?? null;
    audience = audienceRes.wall ?? null;
  } catch {
    /* keep */
  }
}

async function refresh() {
  try {
    const data = await fetchJson("/api/playback");
    if (typeof data.reloadNonce === "number") {
      if (reloadNonce === null) {
        // First observation: adopt without reloading (avoids infinite reload when nonce ≠ 1).
        reloadNonce = data.reloadNonce;
      } else if (data.reloadNonce !== reloadNonce && data.mode !== "performance") {
        // Do not reload mid-performance on routine nonce flaps from ads.
        reloadNonce = data.reloadNonce;
        window.location.reload();
        return;
      } else if (data.reloadNonce !== reloadNonce) {
        reloadNonce = data.reloadNonce;
      }
    }
    apiBase = data.apiBase || apiBase;
    const nextRevision = data.revision || "idle";
    const nextMode = data.mode || "idle";

    if (nextMode === "performance") {
      const item = (data.items && data.items[0]) || null;
      const changed =
        mode !== "performance" ||
        !performanceItem ||
        performanceItem.id !== item?.id ||
        performanceItem.url !== item?.url ||
        performanceItem.muted !== item?.muted ||
        performanceItem.volume !== item?.volume ||
        performanceItem.paused !== item?.paused ||
        performanceItem.seekToken !== item?.seekToken;
      mode = "performance";
      revision = nextRevision;
      playlist = data.items || [];
      performanceItem = item;
      startedAt = data.startedAt || null;
      if (changed) render();
      return;
    }

    // Leaving performance mode: clear performance video so ads can take over cleanly.
    if (mode === "performance" && nextMode !== "performance") {
      performanceItem = null;
      performanceSeekToken = null;
      performanceVideo = null;
    }

    const nextPlaylist = data.playlist || data.items || [];
    const nextStartedAt = data.startedAt || null;

    const nextReadyKey = playlistSignature(nextPlaylist);
    const visibleBefore = chooseVisibleItem(playlist, mode === "playlist" ? index : 0, heldMedia);
    const resolvedStartedAt =
      nextMode === "playlist" && mode === "playlist"
        ? resolveLedPlaylistStartedAt(playlist, startedAt, nextPlaylist, nextStartedAt)
        : nextStartedAt;
    const clockChanged = startedAt !== resolvedStartedAt;
    const revisionChanged = nextRevision !== revision || nextMode !== mode;
    const readyChanged = nextReadyKey !== playlistReadyKey;

    revision = nextRevision;
    mode = nextMode;
    playlist = nextPlaylist;
    startedAt = nextMode === "playlist" ? resolvedStartedAt : nextStartedAt;
    playlistReadyKey = nextReadyKey;
    if (nextMode === "playlist") {
      index = ledPlaylistIndexAt(playlist, startedAt);
    } else {
      index = 0;
    }

    const visibleAfter = chooseVisibleItem(playlist, mode === "playlist" ? index : 0, heldMedia);
    if (visibleAfter?.url) heldMedia = visibleAfter;
    const sameFrame =
      visibleBefore &&
      visibleAfter &&
      visibleBefore.id === visibleAfter.id &&
      visibleBefore.url === visibleAfter.url;
    if ((revisionChanged || readyChanged || clockChanged) && !sameFrame) {
      render();
    }
    await refreshOverlays();
  } catch {
    /* keep current frame */
  }
}

setInterval(() => {
  // Ad rotation only — never advance performances on the timer.
  if (mode === "performance") return;
  if (mode === "playlist" && playlist.length && !trivia && !audience?.tool) {
    const next = ledPlaylistIndexAt(playlist, startedAt);
    if (next !== index) {
      index = next;
      render();
    }
  }
}, 250);

void refresh();
setInterval(() => void refresh(), 1000);
