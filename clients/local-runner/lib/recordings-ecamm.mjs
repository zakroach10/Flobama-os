/**
 * Verified FloBama Ecamm Live session layout (Dropbox-relative):
 *   /A- View 360 Brands/3- Customers/F/Flobama/Recordings
 *   └── Ecamm Recording on YYYY-MM-DD at HH.mm.ss/
 *         ├── Ecamm Recording on YYYY-MM-DD at HH.mm.ss.mp4   ← primary
 *         ├── Camera A.mp4
 *         ├── Camera B.mp4
 *         └── Camera A 002.mp4 …                             ← preserve variants
 *
 * Legacy loose-file layout at /Ecamm Live Recordings is a separate optional source
 * and must never be auto-merged with this root.
 */

import { localPartsToUtcIso } from "./recordings-parse.mjs";

export const DEFAULT_DROPBOX_RELATIVE_ROOT =
  "/A- View 360 Brands/3- Customers/F/Flobama/Recordings";

/** Optional older source — different layout; never auto-merged with the primary root. */
export const LEGACY_ECAMM_LIVE_RELATIVE_ROOT = "/Ecamm Live Recordings";

export const DEFAULT_VENUE_TIMEZONE = "America/Chicago";

export const ECAMM_SESSION_FOLDER_RE =
  /^Ecamm Recording on (20\d{2})-(\d{2})-(\d{2}) at (\d{1,2})\.(\d{2})\.(\d{2})$/i;

export const IGNORE_DIR_NAMES = new Set([
  ".inprogress.nosync",
  ".dropbox",
  ".ds_store",
  "thumbs.db",
]);

export function normalizeDropboxRelativePath(input) {
  let path = String(input || "").trim().replace(/\\/g, "/");
  if (!path) return DEFAULT_DROPBOX_RELATIVE_ROOT;
  if (!path.startsWith("/")) path = `/${path}`;
  path = `/${path
    .split("/")
    .filter(Boolean)
    .join("/")}`;
  return path;
}

export function dropboxRelativeSegments(relativeRoot = DEFAULT_DROPBOX_RELATIVE_ROOT) {
  return normalizeDropboxRelativePath(relativeRoot).split("/").filter(Boolean);
}

export function parseEcammSessionFolderName(folderName) {
  const match = ECAMM_SESSION_FOLDER_RE.exec(String(folderName || "").trim());
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6]),
    rawTimestampText: match[0],
  };
}

/**
 * Parse session folder wall-clock time in the venue timezone (default America/Chicago).
 * Folder names carry no timezone — never use Dropbox mtime as the performance date.
 */
export function parseSessionFolderTimestamp(folderName, timeZone = DEFAULT_VENUE_TIMEZONE) {
  const parts = parseEcammSessionFolderName(folderName);
  if (!parts) {
    return {
      ok: false,
      rawTimestampText: null,
      timezone: timeZone,
      parseSource: null,
      parseConfidence: null,
      error: "Folder name is not an Ecamm session folder.",
    };
  }
  const converted = localPartsToUtcIso(parts, timeZone);
  if (!converted.ok) {
    return {
      ok: false,
      rawTimestampText: parts.rawTimestampText,
      timezone: timeZone,
      parseSource: "ecamm-session-folder",
      parseConfidence: "low",
      error: converted.message,
      code: converted.code,
    };
  }
  return {
    ok: true,
    parsedTimestamp: converted.iso,
    rawTimestampText: parts.rawTimestampText,
    timezone: timeZone,
    parseSource: "ecamm-session-folder",
    parseConfidence: converted.ambiguous ? "medium" : "high",
    ambiguousDst: Boolean(converted.ambiguous),
    dstInterpretations: converted.interpretations || null,
  };
}

export function isIgnoredDirName(name) {
  const lower = String(name || "").toLowerCase();
  if (IGNORE_DIR_NAMES.has(lower)) return true;
  if (lower.endsWith(".nosync")) return true;
  if (lower.startsWith(".")) return true;
  return false;
}

export function isCameraAngleFilename(filename) {
  const base = String(filename || "")
    .replace(/\.[^.]+$/, "")
    .trim();
  return /^camera\b/i.test(base);
}

export function isPrimaryEcammFilename(sessionFolderName, filename) {
  const expected = `${sessionFolderName}.mp4`;
  return String(filename) === expected || String(filename).toLowerCase() === expected.toLowerCase();
}

export function classifySessionVideo(sessionFolderName, filename) {
  if (!/\.(mp4|mov|m4v|webm|mkv)$/i.test(filename)) return null;
  if (isPrimaryEcammFilename(sessionFolderName, filename)) return "primary";
  if (isCameraAngleFilename(filename)) return "camera";
  return "other";
}
