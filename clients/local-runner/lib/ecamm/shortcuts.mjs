import { realpath, stat } from "node:fs/promises";
import { resolve, normalize, sep } from "node:path";

const SETTLE_POLL_MS = 400;
const SETTLE_STABLE_CHECKS = 3;
const SETTLE_TIMEOUT_MS = 30_000;

function isLocalRequest(req) {
  const ra = req?.socket?.remoteAddress || "";
  return ra === "127.0.0.1" || ra === "::1" || ra === "::ffff:127.0.0.1";
}

/**
 * Ensure path resolves under one of the allowed roots (no traversal outside).
 */
export async function validatePathAgainstRoots(filePath, roots) {
  if (!filePath || typeof filePath !== "string") {
    return { ok: false, error: "path required" };
  }
  const rootList = (Array.isArray(roots) ? roots : [roots]).filter(Boolean).map(String);
  if (!rootList.length) {
    return { ok: false, error: "No recordings roots configured." };
  }

  let resolvedPath;
  try {
    resolvedPath = normalize(resolve(filePath));
  } catch {
    return { ok: false, error: "Invalid path." };
  }

  let realFile = resolvedPath;
  try {
    realFile = await realpath(resolvedPath);
  } catch {
    // File may not exist yet (recording_started); still require prefix match on resolved path.
  }

  for (const root of rootList) {
    let realRoot;
    try {
      realRoot = await realpath(resolve(root));
    } catch {
      realRoot = normalize(resolve(root));
    }
    const prefix = realRoot.endsWith(sep) ? realRoot : `${realRoot}${sep}`;
    if (realFile === realRoot || realFile.startsWith(prefix) || resolvedPath.startsWith(prefix)) {
      return { ok: true, path: realFile, root: realRoot };
    }
  }
  return { ok: false, error: "Path is outside configured recordings roots." };
}

async function waitForFileSettle(filePath, { timeoutMs = SETTLE_TIMEOUT_MS } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastSize = -1;
  let stable = 0;
  while (Date.now() < deadline) {
    try {
      const info = await stat(filePath);
      if (!info.isFile()) {
        await new Promise((r) => setTimeout(r, SETTLE_POLL_MS));
        continue;
      }
      if (info.size === lastSize && info.size > 0) {
        stable += 1;
        if (stable >= SETTLE_STABLE_CHECKS) {
          return { ok: true, size: info.size, mtimeMs: info.mtimeMs };
        }
      } else {
        stable = 0;
        lastSize = info.size;
      }
    } catch {
      stable = 0;
      lastSize = -1;
    }
    await new Promise((r) => setTimeout(r, SETTLE_POLL_MS));
  }
  return { ok: false, error: "Timed out waiting for recording file to settle." };
}

/**
 * Shortcuts / Automator notification handler for recording/broadcast lifecycle events.
 */
export function createShortcutsHandler({
  recordingsRootResolver,
  onRecordingEvent,
  sharedSecret,
} = {}) {
  const seen = new Map(); // key -> at

  function remember(key) {
    seen.set(key, Date.now());
    if (seen.size > 200) {
      const oldest = [...seen.entries()].sort((a, b) => a[1] - b[1]).slice(0, 50);
      for (const [k] of oldest) seen.delete(k);
    }
  }

  async function resolveRoots() {
    if (typeof recordingsRootResolver === "function") {
      const roots = await recordingsRootResolver();
      return Array.isArray(roots) ? roots : roots ? [roots] : [];
    }
    return [];
  }

  async function handleNotification(notification, req) {
    if (req && !isLocalRequest(req)) {
      return { ok: false, status: 403, error: "Shortcuts callback is localhost-only." };
    }
    if (sharedSecret) {
      const provided =
        notification?.secret ||
        req?.headers?.["x-flobama-shortcuts-secret"] ||
        "";
      if (provided !== sharedSecret) {
        return { ok: false, status: 401, error: "Invalid shortcuts secret." };
      }
    }

    const type = notification?.type;
    const allowed = new Set([
      "recording_started",
      "recording_finished",
      "broadcast_started",
      "broadcast_finished",
    ]);
    if (!allowed.has(type)) {
      return { ok: false, status: 400, error: `Unknown notification type: ${type}` };
    }

    const path = notification.path ? String(notification.path) : null;
    const at = notification.at || new Date().toISOString();
    const idempotencyKey =
      notification.idempotencyKey ||
      (path ? `${type}:${path}` : `${type}:${at}`);

    if (seen.has(idempotencyKey)) {
      return { ok: true, deduped: true, idempotencyKey };
    }
    // Also dedupe by path for finished events.
    if (path && type.endsWith("_finished") && seen.has(`path:${path}`)) {
      return { ok: true, deduped: true, path };
    }

    if (path) {
      const roots = await resolveRoots();
      const check = await validatePathAgainstRoots(path, roots);
      if (!check.ok) {
        return { ok: false, status: 403, error: check.error };
      }
    }

    let settle = null;
    if (type === "recording_finished" && path) {
      settle = await waitForFileSettle(path);
      if (!settle.ok) {
        return { ok: false, status: 408, error: settle.error, path };
      }
    }

    remember(idempotencyKey);
    if (path) remember(`path:${path}`);

    const event = { type, path, at, idempotencyKey, settle };
    if (typeof onRecordingEvent === "function") {
      await onRecordingEvent(event);
    }
    return { ok: true, event };
  }

  return {
    handleNotification,
    validatePathAgainstRoots,
    waitForFileSettle,
    isLocalRequest,
  };
}
