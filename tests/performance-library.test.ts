import { createServer } from "node:http";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseRecordingFilename, localPartsToUtcIso } from "../clients/local-runner/lib/recordings-parse.mjs";
import {
  isMainEcammRecording,
  resolveUnderRecordingsRoot,
  stableRecordingId,
} from "../clients/local-runner/lib/recordings-paths.mjs";
import { inventoryRecordingsFolder } from "../clients/local-runner/lib/recordings-inventory.mjs";
import { openRecordingsCatalog, mergeScanResults } from "../clients/local-runner/lib/recordings-catalog.mjs";
import { sendRecordingFile, isPathInsideRoot } from "../clients/local-runner/lib/recordings-serve.mjs";
import { matchRecordingToEvents } from "@/lib/performance/match";
import { assignPartLabels, buildPerformanceDisplayTitle } from "@/lib/performance/titles";

describe("ecamm main-recording filter", () => {
  it("keeps Ecamm program files and drops Camera angle views", () => {
    expect(isMainEcammRecording("Ecamm Recording on 2026-08-15 at 20.07.11.mp4")).toBe(true);
    expect(
      isMainEcammRecording(
        "Recording on 2026-08-15 at 20.07.11.mp4",
        "Ecamm Recording on 2026-08-15 at 20.07.11/Recording on 2026-08-15 at 20.07.11.mp4",
      ),
    ).toBe(true);
    expect(isMainEcammRecording("Camera A.mp4")).toBe(false);
    expect(isMainEcammRecording("Camera A 002.mp4", "Ecamm Recording on 2026-08-15 at 20.07.11/Camera A 002.mp4")).toBe(
      false,
    );
    expect(isMainEcammRecording("Camera B.mp4")).toBe(false);
    expect(isMainEcammRecording("random-clip.mp4")).toBe(false);
  });
});

describe("performance filename parsing", () => {
  it("parses Ecamm Live folder/file names", () => {
    const parsed = parseRecordingFilename("Ecamm Recording on 2026-08-15 at 20.07.11.mp4", {
      relativePath: "Ecamm Recording on 2026-08-15 at 20.07.11/Ecamm Recording on 2026-08-15 at 20.07.11.mp4",
    });
    expect(parsed.ok).toBe(true);
    expect(parsed.parseSource).toBe("ecamm-on-date-at-time");
    expect(parsed.parseConfidence).toBe("high");
    expect(parsed.parsedTimestamp).toMatch(/2026-08-1[56]T/);
  });

  it("parses compact and iso-like timestamps in America/Chicago", () => {
    const a = parseRecordingFilename("Show_20261017_213000.mp4");
    expect(a.ok).toBe(true);
    expect(a.parseConfidence).toBe("high");
    expect(a.parsedTimestamp).toMatch(/2026-10-1[78]T/);

    const b = parseRecordingFilename("2026-10-17 21-30-00 FloBama.mov");
    expect(b.ok).toBe(true);
    expect(b.rawTimestampText).toContain("2026-10-17");
  });

  it("marks date-only filenames as low confidence", () => {
    const parsed = parseRecordingFilename("backup-2026-10-17.mp4");
    expect(parsed.ok).toBe(true);
    expect(parsed.parseConfidence).toBe("low");
    expect(parsed.dateOnly).toBe(true);
  });

  it("reports DST spring-forward gaps as invalid", () => {
    // 2026-03-08 02:30 does not exist in America/Chicago
    const result = localPartsToUtcIso(
      { year: 2026, month: 3, day: 8, hour: 2, minute: 30, second: 0 },
      "America/Chicago",
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe("invalid_local");
  });
});

describe("performance event matching", () => {
  const events = [
    {
      id: "e1",
      title: "Early Show",
      starts_at: "2026-10-17T01:00:00.000Z", // 8pm CDT Oct 16
      ends_at: "2026-10-17T03:30:00.000Z",
      status: "published",
      archived_at: null,
      artistNames: ["Artist A"],
    },
    {
      id: "e2",
      title: "Late Show",
      starts_at: "2026-10-18T02:00:00.000Z", // 9pm CDT Oct 17
      ends_at: "2026-10-18T05:00:00.000Z",
      status: "published",
      archived_at: null,
      artistNames: ["Artist B"],
    },
    {
      id: "e3",
      title: "Cancelled",
      starts_at: "2026-10-18T02:30:00.000Z",
      ends_at: "2026-10-18T04:00:00.000Z",
      status: "cancelled",
      archived_at: null,
      artistNames: ["Ghost"],
    },
  ];

  it("auto-matches a clear overlapping recording", () => {
    const result = matchRecordingToEvents(
      {
        recordingId: "r1",
        parsedTimestamp: "2026-10-18T02:30:00.000Z",
        durationSeconds: 3600,
        parseConfidence: "high",
      },
      events,
    );
    expect(result.matchStatus).toBe("matched");
    expect(result.matchedEventId).toBe("e2");
  });

  it("sends cancelled best-hits to needs review", () => {
    const result = matchRecordingToEvents(
      {
        recordingId: "r2",
        parsedTimestamp: "2026-10-18T02:45:00.000Z",
        durationSeconds: 600,
        parseConfidence: "high",
      },
      [events[2]],
    );
    expect(result.matchStatus).toBe("needs_review");
    expect(result.cancelledReview).toBe(true);
  });

  it("preserves manual locks", () => {
    const result = matchRecordingToEvents(
      {
        recordingId: "r3",
        parsedTimestamp: "2026-10-18T02:30:00.000Z",
        durationSeconds: 100,
        parseConfidence: "high",
        matchLocked: true,
        matchedEventId: "e1",
      },
      events,
    );
    expect(result.matchStatus).toBe("manual");
    expect(result.matchedEventId).toBe("e1");
  });

  it("handles after-midnight recordings against the previous evening", () => {
    const result = matchRecordingToEvents(
      {
        recordingId: "r4",
        parsedTimestamp: "2026-10-18T05:20:00.000Z", // shortly after late show ends
        durationSeconds: 600,
        parseConfidence: "high",
      },
      events,
    );
    expect(result.suggestedEventIds).toContain("e2");
  });
});

describe("performance titles", () => {
  it("builds friendly titles without renaming source files", () => {
    const title = buildPerformanceDisplayTitle({
      artistNames: ["River Band"],
      recordingTimestamp: "2026-10-18T02:30:00.000Z",
      timeZone: "America/Chicago",
    });
    expect(title).toContain("River Band");
    expect(title).toContain("Live at FloBama");
    expect(title).toContain("2026");
  });

  it("assigns part labels for chronological groups", () => {
    const labels = assignPartLabels([
      { recordingId: "b", parsedTimestamp: "2026-10-18T03:00:00.000Z" },
      { recordingId: "a", parsedTimestamp: "2026-10-18T02:00:00.000Z" },
    ]);
    expect(labels.get("a")).toBe("Part 1");
    expect(labels.get("b")).toBe("Part 2");
  });
});

describe("recordings inventory + path security", () => {
  it("inventories without duplicating on rescan and rejects traversal", async () => {
    const root = await mkdtemp(join(tmpdir(), "flobama-rec-"));
    // Point catalog file into temp by stubbing SUPPORT is hard; test inventory + resolve directly.
    try {
      const session = join(root, "Ecamm Recording on 2026-08-15 at 20.07.11");
      await mkdir(session, { recursive: true });
      await writeFile(join(session, "Ecamm Recording on 2026-08-15 at 20.07.11.mp4"), Buffer.alloc(2048));
      await writeFile(join(session, "Camera A.mp4"), Buffer.alloc(1024));
      await writeFile(join(session, "Camera B.mp4"), Buffer.alloc(1024));
      await writeFile(join(root, "notes.txt"), "not video");
      const first = await inventoryRecordingsFolder(root);
      expect(first.stats.videoFiles).toBe(1);
      expect(first.stats.skippedCameraOrNonEcamm).toBe(2);
      expect(first.nonVideo.length).toBeGreaterThanOrEqual(3);
      expect(first.scanned[0].originalFilename).toMatch(/Ecamm/i);
      expect(first.scanned[0].recordingId).toBe(stableRecordingId(first.scanned[0].relativePath));

      const second = await inventoryRecordingsFolder(root);
      expect(second.scanned[0].recordingId).toBe(first.scanned[0].recordingId);

      const escaped = await resolveUnderRecordingsRoot(root, "../etc/passwd");
      expect(escaped).toBeNull();

      const abs = await resolveUnderRecordingsRoot(root, "/etc/passwd");
      expect(abs).toBeNull();

      const outside = await mkdtemp(join(tmpdir(), "flobama-out-"));
      const linkPath = join(root, "escape.mp4");
      await writeFile(join(outside, "secret.mp4"), Buffer.alloc(100));
      await symlink(join(outside, "secret.mp4"), linkPath);
      const rejected = await resolveUnderRecordingsRoot(root, "escape.mp4");
      expect(rejected).toBeNull();
      await rm(outside, { recursive: true, force: true });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("supports suffix ranges and invalid range 416", async () => {
    const root = await mkdtemp(join(tmpdir(), "flobama-range-"));
    const file = join(root, "clip.mp4");
    const body = Buffer.from("0123456789abcdefghij");
    await writeFile(file, body);

    async function request(range: string | null, method = "GET") {
      return new Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: Buffer }>(
        (resolve, reject) => {
          const server = createServer(async (req, res) => {
            await sendRecordingFile(res, file, "video/mp4", req);
          });
          server.listen(0, "127.0.0.1", () => {
            const addr = server.address();
            if (!addr || typeof addr === "string") {
              reject(new Error("no port"));
              return;
            }
            const headers: Record<string, string> = {};
            if (range) headers.range = range;
            import("node:http").then(({ request: httpRequest }) => {
              const req = httpRequest(
                { hostname: "127.0.0.1", port: addr.port, path: "/", method, headers },
                (res) => {
                  const chunks: Buffer[] = [];
                  res.on("data", (c) => chunks.push(c));
                  res.on("end", () => {
                    server.close();
                    resolve({ status: res.statusCode || 0, headers: res.headers, body: Buffer.concat(chunks) });
                  });
                },
              );
              req.on("error", reject);
              req.end();
            });
          });
        },
      );
    }

    try {
      const suffix = await request("bytes=-4");
      expect(suffix.status).toBe(206);
      expect(suffix.body.toString()).toBe("ghij");

      const bad = await request("bytes=500-600");
      expect(bad.status).toBe(416);

      const head = await request(null, "HEAD");
      expect(head.status).toBe(200);
      expect(head.body.length).toBe(0);

      expect(isPathInsideRoot(root, file)).toBe(true);
      expect(isPathInsideRoot(root, join(root, "..", "x"))).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("idempotent catalog merge", () => {
  it("does not duplicate recordings and preserves overrides", async () => {
    const root = await mkdtemp(join(tmpdir(), "flobama-cat-"));
    const previous = process.env.HOME;
    process.env.HOME = root;
    try {
      // Re-import won't rebind SUPPORT_DIR; simulate merge API with in-memory-like catalog object.
      const catalog: {
        file: string;
        data: {
          version: number;
          recordingsRoot: string;
          lastScanAt: string | null;
          recordings: Record<string, Record<string, unknown>>;
          nonVideo: unknown[];
          scanStats: Record<string, unknown>;
          prepareJobs: Record<string, unknown>;
          convertJobs: Record<string, unknown>;
          performance: Record<string, unknown>;
        };
      } = {
        file: join(root, "catalog.json"),
        data: {
          version: 1,
          recordingsRoot: root,
          lastScanAt: null,
          recordings: {},
          nonVideo: [],
          scanStats: {},
          prepareJobs: {},
          convertJobs: {},
          performance: { mode: "normal", queue: [], nowPlaying: null, audioMuted: true, revision: 1 },
        },
      };
      await mkdir(root, { recursive: true });
      const videoPath = join(root, "Ecamm Recording on 2026-10-17 at 21.30.00.mp4");
      await writeFile(videoPath, Buffer.alloc(4096));
      const scan = await inventoryRecordingsFolder(root);
      expect(scan.scanned).toHaveLength(1);
      await mergeScanResults(catalog, {
        recordingsRoot: root,
        scanned: scan.scanned.map((row) => ({ ...row, displayTitleOverride: "Locked Title" })),
        nonVideo: scan.nonVideo,
        stats: scan.stats,
      });
      const id = scan.scanned[0].recordingId;
      catalog.data.recordings[id].displayTitleOverride = "Locked Title";
      const scan2 = await inventoryRecordingsFolder(root);
      await mergeScanResults(catalog, {
        recordingsRoot: root,
        scanned: scan2.scanned,
        nonVideo: scan2.nonVideo,
        stats: scan2.stats,
      });
      expect(Object.keys(catalog.data.recordings)).toHaveLength(1);
      expect(catalog.data.recordings[id].displayTitleOverride).toBe("Locked Title");
    } finally {
      process.env.HOME = previous;
      await rm(root, { recursive: true, force: true });
    }
  });
});

// silence unused import if tree shakes openRecordingsCatalog in some runners
void openRecordingsCatalog;
