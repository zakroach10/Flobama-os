import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename, stat, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { blobPath, tmpPath } from "./paths.mjs";
import { getAsset, pinAssets, upsertAsset } from "./cache-db.mjs";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestDownloadGrant(apiBase, token, assetId) {
  const response = await fetch(`${apiBase}/api/agent/v1/display-devices/assets/${assetId}/download`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: "{}",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Download grant failed (${response.status})`);
  }
  return body;
}

async function sha256File(filePath) {
  const buf = await readFile(filePath);
  return { size: buf.byteLength, sha256: createHash("sha256").update(buf).digest("hex") };
}

async function downloadToFile(url, filePath, onProgress) {
  await mkdir(dirname(filePath), { recursive: true });
  let existing = 0;
  try {
    existing = (await stat(filePath)).size;
  } catch {
    existing = 0;
  }

  const headers = {};
  if (existing > 0) headers.range = `bytes=${existing}-`;

  const response = await fetch(url, { headers });
  if (response.status === 416) {
    await unlink(filePath).catch(() => {});
    return downloadToFile(url, filePath, onProgress);
  }
  if (!response.ok || !response.body) {
    throw new Error(`Download HTTP ${response.status}`);
  }

  const append = response.status === 206 && existing > 0;
  const file = createWriteStream(filePath, { flags: append ? "a" : "w" });
  let received = append ? existing : 0;
  const totalHeader = response.headers.get("content-length");
  const total = totalHeader ? received + Number(totalHeader) : null;

  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (!file.write(Buffer.from(value))) {
      await new Promise((resolve) => file.once("drain", resolve));
    }
    if (onProgress) onProgress({ received, total });
  }
  await new Promise((resolve, reject) => {
    file.end((error) => (error ? reject(error) : resolve()));
  });

  return sha256File(filePath);
}

export async function ensureAssetCached(db, config, asset, state) {
  const existing = getAsset(db, asset.id);
  if (existing?.state === "ready" && existing.sha256 && (!asset.sha256 || existing.sha256 === asset.sha256)) {
    const path = blobPath(db.cacheRoot, existing.sha256);
    try {
      await stat(path);
      await upsertAsset(db, { assetId: asset.id, lastUsedAt: new Date().toISOString() });
      return { ok: true, skipped: true, asset: existing };
    } catch {
      /* re-download */
    }
  }

  await upsertAsset(db, {
    assetId: asset.id,
    version: asset.version ?? 1,
    sha256: asset.sha256 ?? null,
    sizeBytes: asset.sizeBytes ?? null,
    mediaType: asset.mediaType ?? null,
    state: "downloading",
    pinned: true,
    path: null,
  });

  let attempt = 0;
  let lastError = null;
  while (attempt < 6) {
    attempt += 1;
    const partial = tmpPath(db.cacheRoot, asset.id);
    try {
      const grant = await requestDownloadGrant(config.apiBase, config.token, asset.id);
      const result = await downloadToFile(grant.url, partial, (progress) => {
        state.downloads[asset.id] = progress;
      });

      if (asset.sha256 && result.sha256 !== asset.sha256.toLowerCase()) {
        await unlink(partial).catch(() => {});
        throw new Error(`Checksum mismatch for ${asset.id}`);
      }

      const finalPath = blobPath(db.cacheRoot, result.sha256);
      await mkdir(dirname(finalPath), { recursive: true });
      await rename(partial, finalPath);
      const ready = await upsertAsset(db, {
        assetId: asset.id,
        version: asset.version ?? 1,
        sha256: result.sha256,
        sizeBytes: result.size,
        mediaType: asset.mediaType ?? grant.mediaType ?? null,
        state: "ready",
        pinned: true,
        path: finalPath,
        verifiedAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
      });
      delete state.downloads[asset.id];
      return { ok: true, skipped: false, asset: ready };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      state.downloads[asset.id] = { error: lastError, attempt };
      await sleep(Math.min(300_000, 1000 * 2 ** (attempt - 1)));
    }
  }

  await upsertAsset(db, { assetId: asset.id, state: "corrupt", lastError });
  delete state.downloads[asset.id];
  return { ok: false, error: lastError };
}

export async function syncManifestAssets(db, config, manifest, state) {
  const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
  await pinAssets(
    db,
    assets.map((asset) => asset.id).filter(Boolean),
  );

  const results = [];
  for (const asset of assets) {
    if (!asset?.id) continue;
    results.push(await ensureAssetCached(db, config, asset, state));
  }
  return results;
}
