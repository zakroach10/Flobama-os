import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateDisplayDevice, readBearerToken } from "@/lib/display-devices/agent-auth";
import { syncPerformanceCatalog } from "@/lib/performance/catalog-sync";

export const dynamic = "force-dynamic";

const assetSchema = z.object({
  assetId: z.string().trim().min(8).max(64),
  role: z.enum(["primary", "camera", "other"]),
  originalFilename: z.string().trim().min(1).max(500),
  relativePath: z.string().trim().min(1).max(2000),
  fileSize: z.number().nonnegative().nullable().optional(),
  availability: z
    .enum([
      "metadata-only",
      "needs download",
      "preparing",
      "ready",
      "unsupported",
      "missing",
      "error",
    ])
    .optional(),
  lastError: z.string().max(500).nullable().optional(),
});

const recordingSchema = z.object({
  recordingId: z.string().trim().min(8).max(64),
  sourceDeviceId: z.string().uuid().nullable().optional(),
  originalFilename: z.string().trim().min(1).max(500),
  relativePath: z.string().trim().min(1).max(2000),
  sessionFolder: z.string().max(500).nullable().optional(),
  sessionRelativePath: z.string().max(2000).nullable().optional(),
  fileSize: z.number().nonnegative().nullable().optional(),
  birthtimeMs: z.number().nullable().optional(),
  mtimeMs: z.number().nullable().optional(),
  parsedTimestamp: z.string().min(1).max(80).nullable().optional(),
  rawTimestampText: z.string().max(200).nullable().optional(),
  timezone: z.string().max(80).nullable().optional(),
  parseSource: z.string().max(80).nullable().optional(),
  parseConfidence: z.string().max(40).nullable().optional(),
  durationSeconds: z.number().nonnegative().nullable().optional(),
  container: z.string().max(80).nullable().optional(),
  videoCodec: z.string().max(80).nullable().optional(),
  audioCodec: z.string().max(80).nullable().optional(),
  width: z.number().int().nonnegative().nullable().optional(),
  height: z.number().int().nonnegative().nullable().optional(),
  hasAudio: z.boolean().nullable().optional(),
  availability: z.enum([
    "metadata-only",
    "needs download",
    "preparing",
    "ready",
    "unsupported",
    "missing",
    "error",
  ]),
  lastScanAt: z.string().min(1).max(80).nullable().optional(),
  lastError: z.string().max(1000).nullable().optional(),
  playbackCompatible: z.boolean().nullable().optional(),
  needsConversion: z.boolean().optional(),
  cameraCount: z.number().int().nonnegative().nullable().optional(),
  primaryAssetId: z.string().max(64).nullable().optional(),
  assets: z.array(assetSchema).max(64).optional(),
});

const bodySchema = z.object({
  recordingsRootConfigured: z.boolean(),
  recordingsRoot: z.string().max(2000).nullable().optional(),
  dropboxRelativeRoot: z.string().max(2000).nullable().optional(),
  lastScanAt: z.string().min(1).max(80).nullable().optional(),
  scanStats: z.record(z.string(), z.unknown()).optional(),
  nonVideoCount: z.number().int().nonnegative().optional(),
  nonVideoSample: z.array(z.unknown()).max(100).optional(),
  recordings: z.array(recordingSchema).max(5000),
  performance: z.unknown().optional(),
});

export async function POST(request: Request) {
  const token = readBearerToken(request);
  if (!token) return NextResponse.json({ error: "Device token required." }, { status: 401 });

  const auth = await authenticateDisplayDevice(token);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.device.kind !== "led_runner") {
    return NextResponse.json({ error: "Only LED Local Runner devices sync the performance catalog." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Check the catalog sync payload.",
        details: parsed.error.issues.slice(0, 8).map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  // Persist playback telemetry when provided
  const performance = parsed.data.performance as
    | {
        mode?: string;
        revision?: number;
        audioMuted?: boolean;
        nowPlaying?: {
          queueItemId?: string;
          recordingId?: string;
          displayTitle?: string;
          positionSeconds?: number;
          durationSeconds?: number;
          paused?: boolean;
          status?: string;
        } | null;
        lastError?: string | null;
        priorWallRevision?: string | null;
      }
    | undefined;

  if (performance) {
    await auth.admin.from("performance_playback_state").upsert(
      {
        device_id: auth.device.id,
        venue_id: auth.device.venue_id,
        mode: performance.mode === "performance" ? "performance" : "normal",
        revision: Number(performance.revision) || 1,
        audio_muted: performance.audioMuted !== false,
        now_playing_queue_item_id: performance.nowPlaying?.queueItemId ?? null,
        now_playing_recording_id: performance.nowPlaying?.recordingId ?? null,
        now_playing_title: performance.nowPlaying?.displayTitle ?? null,
        position_seconds: performance.nowPlaying?.positionSeconds ?? null,
        duration_seconds: performance.nowPlaying?.durationSeconds ?? null,
        paused: Boolean(performance.nowPlaying?.paused),
        status: performance.nowPlaying?.status ?? null,
        prior_wall_revision: performance.priorWallRevision ?? null,
        last_error: performance.lastError ?? null,
        reported_at: new Date().toISOString(),
      },
      { onConflict: "device_id" },
    );
  }

  try {
    const result = await syncPerformanceCatalog(auth.admin, {
      venueId: auth.device.venue_id,
      deviceId: auth.device.id,
      recordingsRootConfigured: parsed.data.recordingsRootConfigured,
      recordingsRoot: parsed.data.recordingsRoot,
      dropboxRelativeRoot: parsed.data.dropboxRelativeRoot,
      lastScanAt: parsed.data.lastScanAt,
      scanStats: parsed.data.scanStats,
      nonVideoCount: parsed.data.nonVideoCount,
      recordings: parsed.data.recordings,
    });
    return NextResponse.json({
      ok: true,
      upserted: result.upserted,
      received: parsed.data.recordings.length,
    });
  } catch (error) {
    console.error("catalog sync failed", error);
    return NextResponse.json({ error: "Could not sync performance catalog." }, { status: 500 });
  }
}
