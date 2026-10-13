import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { blobPath, indexPath } from "./paths.mjs";

/** JSON-backed asset index with atomic writes (SQLite-ready shape). */

export async function openCache(cacheRoot) {
  await mkdir(dirname(indexPath(cacheRoot)), { recursive: true });
  await mkdir(blobPath(cacheRoot, "x").replace(/\/x$/, ""), { recursive: true });
  await mkdir(`${cacheRoot}/tmp`, { recursive: true });
  const db = {
    cacheRoot,
    data: await loadIndex(cacheRoot),
  };
  return db;
}

async function loadIndex(cacheRoot) {
  try {
    const raw = await readFile(indexPath(cacheRoot), "utf8");
    const parsed = JSON.parse(raw);
    return {
      assets: parsed.assets && typeof parsed.assets === "object" ? parsed.assets : {},
      meta: parsed.meta && typeof parsed.meta === "object" ? parsed.meta : {},
    };
  } catch {
    return { assets: {}, meta: {} };
  }
}

async function persist(db) {
  const target = indexPath(db.cacheRoot);
  const tmp = `${target}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(db.data, null, 2)}\n`, "utf8");
  await rename(tmp, target);
}

export function getAsset(db, assetId) {
  return db.data.assets[assetId] ?? null;
}

export function listAssets(db) {
  return Object.values(db.data.assets);
}

export async function upsertAsset(db, asset) {
  db.data.assets[asset.assetId] = {
    ...db.data.assets[asset.assetId],
    ...asset,
    updatedAt: new Date().toISOString(),
  };
  await persist(db);
  return db.data.assets[asset.assetId];
}

export async function setMeta(db, key, value) {
  db.data.meta[key] = value;
  await persist(db);
}

export function getMeta(db, key, fallback = null) {
  return db.data.meta[key] ?? fallback;
}

export function cacheBytesUsed(db) {
  return listAssets(db)
    .filter((asset) => asset.state === "ready")
    .reduce((sum, asset) => sum + (Number(asset.sizeBytes) || 0), 0);
}

export async function pinAssets(db, assetIds) {
  const pinned = new Set(assetIds);
  for (const asset of listAssets(db)) {
    const nextPinned = pinned.has(asset.assetId);
    if (Boolean(asset.pinned) !== nextPinned) {
      asset.pinned = nextPinned;
      asset.updatedAt = new Date().toISOString();
    }
  }
  await persist(db);
}

/** Evict unpinned, non-playing ready assets oldest-first until under limit. */
export async function evictIfNeeded(db, maxCacheBytes, playingAssetId, unlinkFn) {
  let used = cacheBytesUsed(db);
  if (used <= maxCacheBytes) return { used, evicted: [] };
  const candidates = listAssets(db)
    .filter(
      (asset) =>
        asset.state === "ready" &&
        !asset.pinned &&
        asset.assetId !== playingAssetId &&
        asset.sha256,
    )
    .sort((a, b) => String(a.lastUsedAt ?? "").localeCompare(String(b.lastUsedAt ?? "")));
  const evicted = [];
  for (const asset of candidates) {
    if (used <= maxCacheBytes) break;
    try {
      await unlinkFn(blobPath(db.cacheRoot, asset.sha256));
    } catch {
      /* ignore missing */
    }
    used -= Number(asset.sizeBytes) || 0;
    delete db.data.assets[asset.assetId];
    evicted.push(asset.assetId);
  }
  if (evicted.length) await persist(db);
  return { used, evicted };
}
