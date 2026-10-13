/* FloBama local wall player — media from localhost cache; overlays from FloBama APIs. */

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

const stage = document.getElementById("stage");
let revision = "";
let reloadNonce = 1;
let mode = "idle";
let playlist = [];
let startedAt = null;
let index = 0;
let apiBase = "";
let trivia = null;
let audience = null;
/** Tracks url readiness so we re-render when cache finishes under the same revision. */
let playlistReadyKey = "";

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
}

function renderBlack() {
  clearStage();
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

function renderPlaylist() {
  if (!playlist.length) {
    renderBlack();
    return;
  }
  const current = playlist[index] ?? playlist[0];
  if (!current || current.kind === "obs" || !current.url) {
    renderBlack();
    return;
  }
  renderMedia(current, { loop: playlist.length === 1 });
}

function render() {
  if (trivia || audience?.tool) {
    // Overlay UIs are hosted; show black under OBS scene that still hosts overlays, or keep media.
    // Local player keeps last media; trivia/audience preferably use hosted /display/led during those modes.
    return;
  }
  if (mode === "playlist" && playlist.length) {
    renderPlaylist();
    return;
  }
  const active = playlist.find((item) => item.url) || null;
  if (active) {
    renderMedia(active, { loop: true });
    return;
  }
  renderBlack();
}

async function refreshOverlays() {
  if (!apiBase) return;
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
    if (typeof data.reloadNonce === "number" && data.reloadNonce !== reloadNonce) {
      reloadNonce = data.reloadNonce;
      window.location.reload();
      return;
    }
    apiBase = data.apiBase || apiBase;
    const nextRevision = data.revision || "idle";
    const nextMode = data.mode || "idle";
    const nextPlaylist = data.playlist || data.items || [];
    const nextStartedAt = data.startedAt || null;

    const nextReadyKey = playlistSignature(nextPlaylist);
    if (nextRevision !== revision || nextMode !== mode) {
      revision = nextRevision;
      mode = nextMode;
      playlist = nextPlaylist;
      startedAt = nextStartedAt;
      playlistReadyKey = nextReadyKey;
      index = nextMode === "playlist" ? ledPlaylistIndexAt(playlist, startedAt) : 0;
      render();
    } else if (nextReadyKey !== playlistReadyKey) {
      // Same revision, but local cache URLs flipped null → /media/... (or mediaKind filled in).
      playlist = nextPlaylist;
      startedAt = nextStartedAt;
      playlistReadyKey = nextReadyKey;
      if (nextMode === "playlist") {
        index = ledPlaylistIndexAt(playlist, startedAt);
      }
      render();
    } else if (nextMode === "playlist") {
      playlist = nextPlaylist;
      startedAt = nextStartedAt;
    } else {
      playlist = nextPlaylist;
      render();
    }
    await refreshOverlays();
  } catch {
    /* keep current frame */
  }
}

setInterval(() => {
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
