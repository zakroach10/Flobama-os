import { homedir } from "node:os";
import { join } from "node:path";

export const VERSION = "1.2.3";
export const DEFAULT_CACHE_ROOT = "/Users/Shared/FloBamaOS/media";
export const SUPPORT_DIR = join(homedir(), "Library", "Application Support", "FloBama Local Runner");
export const LOG_DIR = join(homedir(), "Library", "Logs", "FloBamaLocalRunner");
export const STATUS_FILE = join(SUPPORT_DIR, "status.json");
export const COMMAND_FILE = join(SUPPORT_DIR, "command.txt");

export function expandHome(path) {
  if (!path) return path;
  if (path.startsWith("~/")) return join(homedir(), path.slice(2));
  return path;
}

export function blobPath(cacheRoot, sha256) {
  return join(cacheRoot, "blobs", sha256);
}

export function tmpPath(cacheRoot, assetId) {
  return join(cacheRoot, "tmp", `${assetId}.partial`);
}

export function indexPath(cacheRoot) {
  return join(cacheRoot, "cache-index.json");
}
