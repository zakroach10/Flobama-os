import { createServer } from "node:http";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseRecordingFilename, localPartsToUtcIso } from "../clients/local-runner/lib/recordings-parse.mjs";
import {
  classifySessionVideo,
  parseEcammSessionFolderName,
  parseSessionFolderTimestamp,
} from "../clients/local-runner/lib/recordings-ecamm.mjs";
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

describe("ecamm session folder model", () => {
  it("parses verified session folder names", () => {
    const parts = parseEcammSessionFolderName("Ecamm Recording on 2026-10-14 at 17.41.33");
    expect(parts).toEqual({
      year: 2026,
      month: 10,
      day: 14,
      hour: 17,
      minute: 41,
      second: 33,
      rawTimestampText: "Ecamm Recording on 2026-10-14 at 17.41.33",
    });
    expect(parseEcammSessionFolderName("Artist Name / August")).toBeNull();
  });

  it("classifies primary and numbered camera variants", () => {
    const folder = "Ecamm Recording on 2026-08-29 at 20.07.11";
    expect(classifySessionVideo(folder, `${folder}.mp4`)).toBe("primary");
    expect(classifySessionVideo(folder, "Camera A.mp4")).toBe("camera");
    expect(classifySessionVideo(folder, "Camera A 002.mp4")).toBe("camera");
    expect(classifySessionVideo(folder, "Camera A 003.mp4")).toBe("camera");
    expect(classifySessionVideo(folder, "Camera B.mp4")).toBe("camera");
    expect(classifySessionVideo(folder, "notes.txt")).toBeNull();
  });

  it("parses session timestamps in America/Chicago from the folder name", () => {
    const parsed = parseSessionFolderTimestamp("Ecamm Recording on 2026-08-29 at 20.07.11");
    expect(parsed.ok).toBe(true);
    expect(parsed.parseSource).toBe("ecamm-session-folder");
    expect(parsed.parseConfidence).toBe("high");
    expect(parsed.parsedTimestamp).toMatch(/2026-08-3[01]T/);
  });
});

describe("ecamm main-recording filter (compat)", () => {
  it("keeps Ecamm program files and drops Camera angle views", () => {
    expect(isMainEcammRecording("Ecamm Recording on 2026-08-15 at 20.07.11.mp4")).toBe(true);
    expect(isMainEcammRecording("Camera A.mp4")).toBe(false);
    expect(isMainEcammRecording("Camera A 002.mp4", "Ecamm Recording on 2026-08-15 at 20.07.11/Camera A 002.mp4")).toBe(
      false,
    );
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
      starts_at: "2026-10-17T01:00:00.000Z",
      ends_at: "2026-10-17T03:30:00.000Z",
      status: "published",
      archived_at: null,
      artistNames: ["Artist A"],
    },
    {
      id: "e2",
      title: "Late Show",
      starts_at: "2026-10-18T02:00:00.000Z",
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
        parsedTimestamp: "2026-10-18T05:20:00.000Z",
        durationSeconds: 600,
        parseConfidence: "high",
      },
      events,
    );
    expect(result.suggestedEventIds).toContain("e2");
  });

  it("leaves ambiguous matches for manual selection", () => {
    const result = matchRecordingToEvents(
      {
        recordingId: "r5",
        parsedTimestamp: "2026-10-18T02:30:00.000Z",
        durationSeconds: 600,
        parseConfidence: "high",
      },
      [
        events[1],
        {
          id: "e4",
          title: "Also Late",
          starts_at: "2026-10-18T02:15:00.000Z",
          ends_at: "2026-10-18T04:45:00.000Z",
          status: "published",
          archived_at: null,
          artistNames: ["Artist C"],
        },
      ],
    );
    expect(result.matchStatus).toBe("needs_review");
    expect(result.matchedEventId).toBeNull();
    expect(result.suggestedEventIds.length).toBeGreaterThanOrEqual(2);
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
  it("inventories one session with primary + preserved camera assets", async () => {
    const root = await mkdtemp(join(tmpdir(), "flobama-rec-"));
    try {
      const sessionName = "Ecamm Recording on 2026-08-29 at 20.07.11";
      const session = join(root, sessionName);
      await mkdir(session, { recursive: true });
      await writeFile(join(session, `${sessionName}.mp4`), Buffer.alloc(2048));
      await writeFile(join(session, "Camera A.mp4"), Buffer.alloc(1024));
      await writeFile(join(session, "Camera A 002.mp4"), Buffer.alloc(1024));
      await writeFile(join(session, "Camera A 003.mp4"), Buffer.alloc(1024));
      await writeFile(join(session, "Camera B.mp4"), Buffer.alloc(1024));
      await writeFile(join(root, "notes.txt"), "not video");
      await mkdir(join(root, ".inProgress.nosync"), { recursive: true });
      await writeFile(join(root, ".inProgress.nosync", "partial.mp4"), Buffer.alloc(100));
      await mkdir(join(root, "Some Artist August"), { recursive: true });

      const first = await inventoryRecordingsFolder(root);
      expect(first.stats.sessionFolders).toBe(1);
      expect(first.stats.skippedIgnoredDirs).toBeGreaterThanOrEqual(1);
      expect(first.stats.cameraAssets).toBe(4);
      expect(first.scanned).toHaveLength(1);
      expect(first.scanned[0].sessionFolder).toBe(sessionName);
      expect(first.scanned[0].recordingId).toBe(stableRecordingId(sessionName));
      expect(first.scanned[0].relativePath).toBe(`${sessionName}/${sessionName}.mp4`);
      expect(first.scanned[0].assets.map((a: { role: string; originalFilename: string }) => a.role)).toEqual([
        "primary",
        "camera",
        "camera",
        "camera",
        "camera",
      ]);
      expect(first.scanned[0].assets.some((a: { originalFilename: string }) => a.originalFilename === "Camera A 003.mp4")).toBe(
        true,
      );
      expect(first.scanned[0].parseSource).toBe("ecamm-session-folder");

      // Camera A.mp4 in another session must get a different asset id
      const session2Name = "Ecamm Recording on 2026-10-14 at 17.41.33";
      const session2 = join(root, session2Name);
      await mkdir(session2, { recursive: true });
      await writeFile(join(session2, `${session2Name}.mp4`), Buffer.alloc(2048));
      await writeFile(join(session2, "Camera A.mp4"), Buffer.alloc(512));
      const second = await inventoryRecordingsFolder(root);
      expect(second.stats.sessionFolders).toBe(2);
      const camIds = second.scanned.flatMap((s: { assets: Array<{ originalFilename: string; assetId: string }> }) =>
        s.assets.filter((a) => a.originalFilename === "Camera A.mp4").map((a) => a.assetId),
      );
      expect(new Set(camIds).size).toBe(2);

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
  it("does not duplicate sessions and preserves overrides", async () => {
    const root = await mkdtemp(join(tmpdir(), "flobama-cat-"));
    const previous = process.env.HOME;
    process.env.HOME = root;
    try {
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
          version: 2,
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
      const sessionName = "Ecamm Recording on 2026-10-17 at 21.30.00";
      const session = join(root, sessionName);
      await mkdir(session, { recursive: true });
      await writeFile(join(session, `${sessionName}.mp4`), Buffer.alloc(4096));
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

void openRecordingsCatalog;
