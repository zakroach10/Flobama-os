import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { startHttpServer } from "../clients/local-runner/lib/http-server.mjs";
import {
  runnerPreloadReports,
  shouldSendPreloadReport,
} from "../clients/local-runner/lib/preload-status.mjs";
import { LOCAL_WALL_POLL_MS } from "@/lib/screens/led-preload";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC",
  "base64",
);

describe("runner preload status", () => {
  it("does not call a file ready until the wall player decodes that version", () => {
    const playerReady = new Map();
    const cached = { state: "ready", sha256: "abc", lastError: null };
    const loading = runnerPreloadReports({
      preloadAssetIds: ["scene-b"],
      getAsset: () => cached,
      playerReady,
    });
    expect(loading[0]).toMatchObject({ state: "loading" });
    playerReady.set("scene-b", { state: "ready", sha256: "old" });
    const stale = runnerPreloadReports({
      preloadAssetIds: ["scene-b"],
      getAsset: () => cached,
      playerReady,
    });
    expect(stale[0]?.state).toBe("loading");
    playerReady.set("scene-b", { state: "ready", sha256: "abc" });
    const ready = runnerPreloadReports({
      preloadAssetIds: ["scene-b"],
      getAsset: () => cached,
      playerReady,
    });
    expect(ready[0]).toMatchObject({ state: "ready", message: null });
  });

  it("sends a report when the state changes and stays quiet until the keepalive", () => {
    const reports = [{ assetId: "scene-b", state: "loading", message: "Downloading to this Mac" }];
    const first = shouldSendPreloadReport("", reports, 1_000, 0);
    expect(first.send).toBe(true);
    const quiet = shouldSendPreloadReport(first.signature, reports, 2_000, 1_000);
    expect(quiet.send).toBe(false);
    const changed = shouldSendPreloadReport(first.signature, [{ ...reports[0], state: "ready" }], 2_000, 1_000);
    expect(changed.send).toBe(true);
  });
});

describe("local wall playback", () => {
  const servers: Array<{ close: () => void }> = [];
  const dirs: string[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("serves a preloaded file without making it the live scene, then swaps after the poll", async () => {
    const cacheRoot = await mkdtemp(join(tmpdir(), "flobama-preload-"));
    dirs.push(cacheRoot);
    const blobs = join(cacheRoot, "blobs");
    await mkdir(blobs, { recursive: true });
    const filePath = join(blobs, "scene-b.png");
    await writeFile(filePath, png);
    const assets = {
      "scene-a": {
        assetId: "scene-a",
        state: "downloading",
        sha256: null,
        mediaType: "image/png",
        path: null,
      },
      "scene-b": {
        assetId: "scene-b",
        state: "ready",
        sha256: "abc123",
        mediaType: "image/png",
        path: filePath,
      },
    };
    const runtime = {
      version: "1.3.3",
      config: { bindHost: "127.0.0.1", bindPort: 0, apiBase: "https://example.test", maxCacheBytes: 1000 },
      db: { cacheRoot, data: { assets, meta: {} } },
      manifest: {
        mode: "scene",
        revision: "live-a",
        startedAt: null,
        playlistId: null,
        reloadNonce: 3,
        preloadAssetIds: ["scene-b"],
        assets: [],
        items: [
          {
            slotId: "scene-a",
            kind: "media",
            assetId: "scene-a",
            durationSeconds: 15,
            transition: "cut",
            obsSceneName: null,
          },
        ],
      },
      manifestRevision: "live-a",
      reloadNonce: 3,
      state: { downloads: {} },
      recordingsCatalog: null,
      playerReady: new Map(),
      log: async () => {},
    };
    const server = await startHttpServer(runtime);
    servers.push(server);
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No port");
    const base = `http://127.0.0.1:${address.port}`;

    const before = await fetch(`${base}/api/playback`).then((res) => res.json());
    expect(before.active).toBeNull();
    expect(before.preload[0].id).toBe("scene-b");
    expect(before.preload[0].url).toContain("/media/scene-b?v=");
    expect(before.preload[0].state).toBe("loading");

    const fileStarted = performance.now();
    const file = await fetch(`${base}${before.preload[0].url}`);
    const fileMs = performance.now() - fileStarted;
    expect(file.status).toBe(200);
    expect(fileMs).toBeLessThan(500);

    const reported = await fetch(`${base}/api/preload`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reports: [{ assetId: "scene-b", state: "ready" }] }),
    });
    expect(reported.status).toBe(200);
    const decoded = await fetch(`${base}/api/playback`).then((res) => res.json());
    expect(decoded.preload[0].state).toBe("ready");

    const commandAt = performance.now();
    // Production heartbeat is 2000ms. This run uses a short stand-in so the test stays bounded.
    const testHeartbeatMs = 200;
    let seenAt = 0;
    const poll = setInterval(() => {
      void fetch(`${base}/api/playback`)
        .then((res) => res.json())
        .then((body) => {
          if (!seenAt && body.active?.url?.includes("/media/scene-b")) seenAt = performance.now();
        })
        .catch(() => {});
    }, LOCAL_WALL_POLL_MS);
    await new Promise((resolve) => setTimeout(resolve, testHeartbeatMs));
    runtime.manifest = {
      ...runtime.manifest,
      revision: "live-b",
      preloadAssetIds: [],
      items: [
        {
          slotId: "scene-b",
          kind: "media",
          assetId: "scene-b",
          durationSeconds: 15,
          transition: "cut",
          obsSceneName: null,
        },
      ],
    };
    const deadline = Date.now() + LOCAL_WALL_POLL_MS + 1500;
    while (!seenAt && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    clearInterval(poll);
    expect(seenAt).toBeGreaterThan(0);
    const commandToVisible = seenAt - commandAt;
    // The player poll is the real 1000ms interval. The heartbeat here is the 200ms stand-in, not the venue Mac.
    expect(commandToVisible).toBeGreaterThanOrEqual(LOCAL_WALL_POLL_MS - 50);
    expect(commandToVisible).toBeLessThan(testHeartbeatMs + LOCAL_WALL_POLL_MS + 800);
  });
});
