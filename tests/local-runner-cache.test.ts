import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cacheBytesUsed, openCache, pinAssets, upsertAsset } from "../clients/local-runner/lib/cache-db.mjs";

describe("local-runner cache index", () => {
  it("persists ready assets and pins", async () => {
    const root = await mkdtemp(join(tmpdir(), "flobama-cache-"));
    try {
      const db = await openCache(root);
      await upsertAsset(db, {
        assetId: "a1",
        sha256: "abc",
        sizeBytes: 1000,
        state: "ready",
        pinned: false,
      });
      await upsertAsset(db, {
        assetId: "a2",
        sha256: "def",
        sizeBytes: 2000,
        state: "ready",
        pinned: false,
      });
      expect(cacheBytesUsed(db)).toBe(3000);
      await pinAssets(db, ["a1"]);
      const reopened = await openCache(root);
      expect(reopened.data.assets.a1.pinned).toBe(true);
      expect(reopened.data.assets.a2.pinned).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
