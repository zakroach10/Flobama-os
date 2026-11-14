/** How often a steady preload state is repeated so the admin screen does not go stale. */
export const PRELOAD_KEEPALIVE_MS = 4 * 60 * 1000;

/**
 * Per-scene Local Runner status. Ready means the file is on disk AND the wall player decoded it.
 * A pin or a finished download alone is not ready.
 */
export function runnerPreloadReports({ preloadAssetIds, getAsset, playerReady }) {
  const ids = Array.isArray(preloadAssetIds) ? preloadAssetIds : [];
  return ids.filter(Boolean).map((assetId) => {
    const cached = typeof getAsset === "function" ? getAsset(assetId) : null;
    const player = playerReady?.get?.(assetId) || null;
    if (!cached || cached.state === "downloading" || cached.state === "missing") {
      return { assetId, state: "loading", message: "Downloading to this Mac" };
    }
    if (cached.state === "corrupt" || cached.state === "error") {
      return { assetId, state: "error", message: cached.lastError || "Download failed" };
    }
    if (cached.state === "ready" && player?.state === "error") {
      return { assetId, state: "error", message: player.message || "Wall player could not decode it" };
    }
    if (cached.state === "ready" && player?.state === "ready" && player.sha256 && player.sha256 === cached.sha256) {
      return { assetId, state: "ready", message: null };
    }
    if (cached.state === "ready") {
      return { assetId, state: "loading", message: "On this Mac, waiting for the wall player" };
    }
    return { assetId, state: "loading", message: "Not on this Mac yet" };
  });
}

export function preloadReportSignature(reports) {
  return JSON.stringify(reports);
}

/** Send on change, and occasionally while the set is unchanged. Omit the field otherwise. */
export function shouldSendPreloadReport(previousSignature, reports, nowMs, lastSentAt, keepaliveMs = PRELOAD_KEEPALIVE_MS) {
  const signature = preloadReportSignature(reports);
  if (signature !== previousSignature) return { send: true, signature };
  if (!lastSentAt || nowMs - lastSentAt >= keepaliveMs) return { send: true, signature };
  return { send: false, signature: previousSignature };
}
