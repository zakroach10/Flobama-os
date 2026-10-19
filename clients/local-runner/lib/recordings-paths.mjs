import { createHash } from "node:crypto";
import { access, readdir, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, normalize, relative, resolve, sep } from "node:path";
import { SUPPORT_DIR, expandHome } from "./paths.mjs";
import {
  DEFAULT_DROPBOX_RELATIVE_ROOT,
  DEFAULT_VENUE_TIMEZONE,
  dropboxRelativeSegments,
  isCameraAngleFilename,
  normalizeDropboxRelativePath,
} from "./recordings-ecamm.mjs";

export const RECORDINGS_CATALOG_FILE = join(SUPPORT_DIR, "recordings-catalog.json");
export const PERFORMANCE_CACHE_DIR = join(SUPPORT_DIR, "performance-cache");
export const RECORDINGS_SETTINGS_FILE = join(SUPPORT_DIR, "recordings-settings.json");

/** Video extensions we attempt to catalog as performances. */
export const VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".mov",
  ".m4v",
  ".webm",
  ".mkv",
  ".avi",
  ".mpg",
  ".mpeg",
  ".ts",
  ".m2ts",
]);

export { DEFAULT_DROPBOX_RELATIVE_ROOT, DEFAULT_VENUE_TIMEZONE };

/**
 * Stable id from a full relative path (session folder or asset). Never filename alone —
 * "Camera A.mp4" repeats across sessions.
 */
export function stableRecordingId(relativePath) {
  const normalized = String(relativePath || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
  return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}

export async function pathExists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

/** Candidate Dropbox roots for the logged-in macOS user (CloudStorage + legacy). */
export async function discoverDropboxRoots(home = homedir()) {
  const roots = [];
  const legacy = join(home, "Dropbox");
  if (await pathExists(legacy)) roots.push(legacy);

  const cloudStorage = join(home, "Library", "CloudStorage");
  if (await pathExists(cloudStorage)) {
    try {
      const entries = await readdir(cloudStorage, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (!/^Dropbox/i.test(entry.name)) continue;
        roots.push(join(cloudStorage, entry.name));
      }
    } catch {
      /* ignore */
    }
  }

  try {
    const homeEntries = await readdir(home, { withFileTypes: true });
    for (const entry of homeEntries) {
      if (!entry.isDirectory()) continue;
      if (!/^Dropbox/i.test(entry.name)) continue;
      const full = join(home, entry.name);
      if (!roots.includes(full) && (await pathExists(full))) roots.push(full);
    }
  } catch {
    /* ignore */
  }

  return roots;
}

/**
 * Join a Dropbox sync root with a Dropbox-relative path (leading slash ok).
 * Returns absolute local path if every segment exists; otherwise null.
 */
export async function joinDropboxRelative(dropboxRoot, relativeRoot) {
  if (!dropboxRoot) return null;
  const segments = dropboxRelativeSegments(relativeRoot);
  let current = dropboxRoot;
  for (const segment of segments) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return null;
    }
    const match = entries.find(
      (entry) =>
        (entry.isDirectory() || entry.isSymbolicLink()) &&
        (entry.name === segment || entry.name.toLowerCase() === segment.toLowerCase()),
    );
    if (!match) return null;
    current = join(current, match.name);
  }
  if (!(await pathExists(current))) return null;
  return current;
}

/**
 * Resolve the verified FloBama Recordings folder from Dropbox-relative path only.
 * Does not return similarly named Recordings folders elsewhere.
 */
export async function resolveDropboxRelativeRoot(options = {}) {
  const home = options.home || homedir();
  const relativeRoot = normalizeDropboxRelativePath(
    options.dropboxRelativeRoot || DEFAULT_DROPBOX_RELATIVE_ROOT,
  );
  const roots = options.roots || (await discoverDropboxRoots(home));
  const found = [];
  for (const root of roots) {
    const match = await joinDropboxRelative(root, relativeRoot);
    if (match) found.push(match);
  }
  return {
    dropboxRelativeRoot: relativeRoot,
    candidates: [...new Set(found)].sort(),
  };
}

/**
 * Discover the configured FloBama Recordings root(s).
 * Uses the exact Dropbox-relative path — never auto-merges other Recordings trees.
 */
export async function discoverRecordingsCandidates(options = {}) {
  const resolved = await resolveDropboxRelativeRoot(options);
  return resolved.candidates;
}

/**
 * Prefer an explicit local absolute path; otherwise resolve Dropbox-relative against sync roots.
 */
export async function resolveConfiguredRecordingsRoot(settings = {}, options = {}) {
  const dropboxRelativeRoot = normalizeDropboxRelativePath(
    settings.dropboxRelativeRoot || DEFAULT_DROPBOX_RELATIVE_ROOT,
  );
  const explicit = settings.recordingsRoot ? expandHome(String(settings.recordingsRoot)) : null;
  if (explicit && (await pathExists(explicit))) {
    return {
      recordingsRoot: explicit,
      dropboxRelativeRoot,
      source: "absolute",
      candidates: [explicit],
    };
  }

  const { candidates } = await resolveDropboxRelativeRoot({
    ...options,
    dropboxRelativeRoot,
  });
  return {
    recordingsRoot: candidates[0] || null,
    dropboxRelativeRoot,
    source: candidates.length ? "dropbox-relative" : "unresolved",
    candidates,
  };
}

export async function loadRecordingsSettings() {
  try {
    const { readFile } = await import("node:fs/promises");
    const raw = JSON.parse(await readFile(RECORDINGS_SETTINGS_FILE, "utf8"));
    return {
      recordingsRoot: raw.recordingsRoot ? expandHome(String(raw.recordingsRoot)) : null,
      dropboxRelativeRoot: normalizeDropboxRelativePath(
        raw.dropboxRelativeRoot || DEFAULT_DROPBOX_RELATIVE_ROOT,
      ),
      defaultTimezone: String(raw.defaultTimezone || DEFAULT_VENUE_TIMEZONE),
      selectedAt: raw.selectedAt || null,
    };
  } catch {
    return {
      recordingsRoot: null,
      dropboxRelativeRoot: DEFAULT_DROPBOX_RELATIVE_ROOT,
      defaultTimezone: DEFAULT_VENUE_TIMEZONE,
      selectedAt: null,
    };
  }
}

export async function saveRecordingsSettings(settings) {
  const { mkdir, writeFile, rename } = await import("node:fs/promises");
  await mkdir(SUPPORT_DIR, { recursive: true });
  const payload = {
    recordingsRoot: settings.recordingsRoot || null,
    dropboxRelativeRoot: normalizeDropboxRelativePath(
      settings.dropboxRelativeRoot || DEFAULT_DROPBOX_RELATIVE_ROOT,
    ),
    defaultTimezone: settings.defaultTimezone || DEFAULT_VENUE_TIMEZONE,
    selectedAt: settings.selectedAt || new Date().toISOString(),
  };
  const tmp = `${RECORDINGS_SETTINGS_FILE}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await rename(tmp, RECORDINGS_SETTINGS_FILE);
  return payload;
}

/**
 * Resolve a path under recordingsRoot. Rejects traversal and symlink escapes.
 * Returns absolute real path or null.
 */
export async function resolveUnderRecordingsRoot(recordingsRoot, relativePath) {
  if (!recordingsRoot || !relativePath) return null;
  const rootReal = await realpath(recordingsRoot).catch(() => null);
  if (!rootReal) return null;

  const cleaned = String(relativePath).replace(/\\/g, "/");
  if (cleaned.includes("\0") || cleaned.startsWith("/") || cleaned.startsWith("~")) return null;
  const parts = cleaned.split("/").filter(Boolean);
  if (parts.some((part) => part === ".." || part === ".")) return null;

  const joined = normalize(join(rootReal, cleaned));
  if (!joined.startsWith(rootReal + sep) && joined !== rootReal) return null;

  let fileReal;
  try {
    fileReal = await realpath(joined);
  } catch {
    return null;
  }
  if (!fileReal.startsWith(rootReal + sep) && fileReal !== rootReal) return null;
  return fileReal;
}

export function relativeFromRoot(recordingsRoot, absolutePath) {
  const rel = relative(recordingsRoot, absolutePath);
  if (!rel || rel.startsWith("..") || resolve(recordingsRoot, rel) !== resolve(absolutePath)) {
    return null;
  }
  return rel.split(sep).join("/");
}

export function isVideoFilename(name) {
  const lower = String(name).toLowerCase();
  const dot = lower.lastIndexOf(".");
  if (dot < 0) return false;
  return VIDEO_EXTENSIONS.has(lower.slice(dot));
}

export { isCameraAngleFilename };

/**
 * @deprecated Prefer session-folder inventory. Kept for tests/compat:
 * primary Ecamm program file (not Camera A/B).
 */
export function isMainEcammRecording(filename, relativePath = null) {
  if (isCameraAngleFilename(filename)) return false;
  const name = String(filename || "");
  if (/ecamm/i.test(name)) return true;
  if (relativePath && /ecamm/i.test(String(relativePath))) return true;
  return false;
}

export function ecammSkipReason(filename, relativePath = null) {
  if (isCameraAngleFilename(filename)) {
    return "Camera angle — attached as a session asset, not a separate catalog row.";
  }
  if (!isMainEcammRecording(filename, relativePath)) {
    return "Not an Ecamm session primary.";
  }
  return null;
}

export async function openInFinder(targetPath) {
  if (process.platform !== "darwin") {
    return { ok: false, error: "Open in Finder is only available on macOS." };
  }
  const { spawn } = await import("node:child_process");
  return new Promise((resolvePromise) => {
    const child = spawn("open", [targetPath], { stdio: "ignore", detached: true });
    child.on("error", (error) => resolvePromise({ ok: false, error: error.message }));
    child.unref();
    resolvePromise({ ok: true });
  });
}

export { basename, dirname, join, relative, resolve, sep };
