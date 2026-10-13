import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getMeta, openCache, setMeta, upsertAsset } from "../clients/local-runner/lib/cache-db.mjs";
import { playbackPayload } from "../clients/local-runner/lib/http-server.mjs";

describe("local-runner playback payload", () => {
  it("exposes local media urls only after cache is ready", async () => {
    const root = await mkdtemp(join(tmpdir(), "flobama-playback-"));
    try {
      const db = await openCache(root);
      const runtime = {
        db,
        config: { apiBase: "https://example.test" },
        reloadNonce: 1,
        manifest: {
          revision: "rev-1",
          mode: "playlist",
          startedAt: new Date().toISOString(),
          playlistId: "p1",
          reloadNonce: 1,
          items: [
            {
              slotId: "slot-1",
              kind: "media",
              assetId: "scene-1",
              durationSeconds: 10,
              obsSceneName: null,
            },
          ],
        },
        manifestRevision: "rev-1",
      };

      const pending = playbackPayload(runtime);
      expect(pending.mode).toBe("playlist");
      expect(pending.playlist[0].url).toBeNull();

      await upsertAsset(db, {
        assetId: "scene-1",
        sha256: "abc123",
        mediaType: "video/mp4",
        state: "ready",
        pinned: true,
      });

      const ready = playbackPayload(runtime);
      expect(ready.playlist[0].url).toBe("/media/scene-1");
      expect(ready.playlist[0].mediaKind).toBe("video");
      expect(ready.apiBase).toBe("https://example.test");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("restores idle payload shape when manifest is missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "flobama-idle-"));
    try {
      const db = await openCache(root);
      await setMeta(db, "manifestRevision", "stale-rev");
      const payload = playbackPayload({
        db,
        config: { apiBase: "https://example.test" },
        manifest: null,
        manifestRevision: getMeta(db, "manifestRevision"),
        reloadNonce: 9,
      });
      expect(payload.mode).toBe("idle");
      expect(payload.playlist).toEqual([]);
      expect(payload.revision).toBe("stale-rev");
      expect(payload.reloadNonce).toBe(9);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
