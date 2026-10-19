import { createHash } from "node:crypto";
import { access, readdir, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, normalize, relative, resolve, sep } from "node:path";
import { SUPPORT_DIR, expandHome } from "./paths.mjs";

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

/**
 * Hint segments from the Finder hierarchy (Dropbox / A- View 360 Brands / … / Recordings).
 * Used only for discovery — never treated as a verified absolute path.
 */
export const RECORDINGS_PATH_HINTS = [
  ["A- View 360 Brands", "3- Customers", "F", "Flobama", "Recordings"],
  ["A- View 360 Brands", "3- Customers", "F", "FloBama", "Recordings"],
  ["A- View 360 Brands", "3-Customers", "F", "Flobama", "Recordings"],
  ["View 360 Brands", "3- Customers", "F", "Flobama", "Recordings"],
];

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

  // Some installs use ~/Dropbox (Personal) or team folders as siblings.
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

async function findHintMatchesUnder(root, hintSegments) {
  const matches = [];

  async function walk(dir, depth, segmentIndex) {
    if (depth > 12 || segmentIndex >= hintSegments.length) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    const want = hintSegments[segmentIndex];
    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      if (entry.name !== want && entry.name.toLowerCase() !== want.toLowerCase()) continue;
      const next = join(dir, entry.name);
      if (segmentIndex === hintSegments.length - 1) {
        matches.push(next);
      } else {
        await walk(next, depth + 1, segmentIndex + 1);
      }
    }
  }

  await walk(root, 0, 0);
  return matches;
}

/**
 * Discover candidate Recordings folders. Returns unique absolute paths.
 * Does not download cloud content — only lists directories that are already visible.
 */
export async function discoverRecordingsCandidates(options = {}) {
  const home = options.home || homedir();
  const roots = options.roots || (await discoverDropboxRoots(home));
  const found = new Set();

  for (const root of roots) {
    for (const hint of RECORDINGS_PATH_HINTS) {
      const matches = await findHintMatchesUnder(root, hint);
      for (const match of matches) found.add(match);
    }
    // Also accept a top-level Recordings folder under Dropbox / Flobama-ish paths.
    const shallow = [
      join(root, "Flobama", "Recordings"),
      join(root, "FloBama", "Recordings"),
      join(root, "Recordings"),
    ];
    for (const candidate of shallow) {
      if (await pathExists(candidate)) found.add(candidate);
    }
  }

  return [...found].sort();
}

export async function loadRecordingsSettings() {
  try {
    const { readFile } = await import("node:fs/promises");
    const raw = JSON.parse(await readFile(RECORDINGS_SETTINGS_FILE, "utf8"));
    return {
      recordingsRoot: raw.recordingsRoot ? expandHome(String(raw.recordingsRoot)) : null,
      defaultTimezone: String(raw.defaultTimezone || "America/Chicago"),
      selectedAt: raw.selectedAt || null,
    };
  } catch {
    return { recordingsRoot: null, defaultTimezone: "America/Chicago", selectedAt: null };
  }
}

export async function saveRecordingsSettings(settings) {
  const { mkdir, writeFile, rename } = await import("node:fs/promises");
  await mkdir(SUPPORT_DIR, { recursive: true });
  const payload = {
    recordingsRoot: settings.recordingsRoot || null,
    defaultTimezone: settings.defaultTimezone || "America/Chicago",
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
