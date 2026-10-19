import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import { DEFAULT_VENUE_TIMEZONE } from "@/lib/constants";
import { artistNames, type EventRow } from "@/lib/queries/events";
import { matchRecordingToEvents, type MatchCandidateEvent } from "@/lib/performance/match";
import { assignPartLabels, buildPerformanceDisplayTitle } from "@/lib/performance/titles";

type Admin = SupabaseClient<Database>;

export type CatalogSyncRecording = {
  recordingId: string;
  sourceDeviceId?: string | null;
  originalFilename: string;
  relativePath: string;
  fileSize?: number | null;
  birthtimeMs?: number | null;
  mtimeMs?: number | null;
  parsedTimestamp?: string | null;
  rawTimestampText?: string | null;
  timezone?: string | null;
  parseSource?: string | null;
  parseConfidence?: string | null;
  durationSeconds?: number | null;
  container?: string | null;
  videoCodec?: string | null;
  audioCodec?: string | null;
  width?: number | null;
  height?: number | null;
  hasAudio?: boolean | null;
  availability: string;
  lastScanAt?: string | null;
  lastError?: string | null;
  playbackCompatible?: boolean | null;
  needsConversion?: boolean;
};

const AVAILABILITY = new Set([
  "metadata-only",
  "needs download",
  "preparing",
  "ready",
  "unsupported",
  "missing",
  "error",
]);

function normalizeAvailability(value: string) {
  return AVAILABILITY.has(value) ? value : "error";
}

async function loadCandidateEvents(admin: Admin, venueId: string): Promise<MatchCandidateEvent[]> {
  // Include historical / archived; exclude nothing by window — staff catalog needs past shows.
  const { data, error } = await admin
    .from("events")
    .select(
      `
      id, title, starts_at, ends_at, status, archived_at,
      event_artists (
        display_order,
        artists ( name )
      )
    `,
    )
    .eq("venue_id", venueId)
    .order("starts_at", { ascending: false })
    .limit(2000);

  if (error || !data) return [];

  return (data as unknown as EventRow[]).map((event) => ({
    id: event.id,
    title: event.title,
    starts_at: event.starts_at,
    ends_at: event.ends_at,
    status: event.status,
    archived_at: event.archived_at,
    artistNames: artistNames(event),
  }));
}

export async function syncPerformanceCatalog(
  admin: Admin,
  args: {
    venueId: string;
    deviceId: string;
    recordingsRootConfigured: boolean;
    recordingsRoot?: string | null;
    lastScanAt?: string | null;
    scanStats?: Record<string, unknown> | null;
    nonVideoCount?: number;
    recordings: CatalogSyncRecording[];
  },
) {
  const events = await loadCandidateEvents(admin, args.venueId);
  const eventById = new Map(events.map((e) => [e.id, e]));
  const timeZone = DEFAULT_VENUE_TIMEZONE;

  const { data: existingRows } = await admin
    .from("performance_recordings")
    .select(
      "id, recording_id, match_locked, matched_event_id, display_title, display_title_locked, match_status",
    )
    .eq("venue_id", args.venueId);

  const existingByRecordingId = new Map(
    (existingRows ?? []).map((row) => [row.recording_id, row]),
  );

  // First pass: upsert core metadata + match (respect locks)
  const upsertedIds: string[] = [];
  const matchedGroups = new Map<string, Array<{ recordingId: string; parsedTimestamp: string | null }>>();

  for (const rec of args.recordings) {
    const prior = existingByRecordingId.get(rec.recordingId);
    const match = matchRecordingToEvents(
      {
        recordingId: rec.recordingId,
        parsedTimestamp: rec.parsedTimestamp ?? null,
        durationSeconds: rec.durationSeconds ?? null,
        parseConfidence: rec.parseConfidence ?? null,
        parseDateOnly: rec.parseConfidence === "low" && Boolean(rec.parsedTimestamp),
        matchLocked: Boolean(prior?.match_locked),
        matchedEventId: prior?.matched_event_id ?? null,
      },
      events,
      { timeZone },
    );

    const matchedEvent = match.matchedEventId ? eventById.get(match.matchedEventId) : null;
    let displayTitle = prior?.display_title_locked ? prior.display_title : null;
    if (!displayTitle) {
      displayTitle = buildPerformanceDisplayTitle({
        artistNames: matchedEvent?.artistNames || [],
        eventTitle: matchedEvent?.title,
        recordingTimestamp: rec.parsedTimestamp ?? null,
        timeZone: rec.timezone || timeZone,
        originalFilename: rec.originalFilename,
      });
    }

    if (match.matchedEventId) {
      const group = matchedGroups.get(match.matchedEventId) || [];
      group.push({ recordingId: rec.recordingId, parsedTimestamp: rec.parsedTimestamp ?? null });
      matchedGroups.set(match.matchedEventId, group);
    }

    const patch = {
      venue_id: args.venueId,
      source_device_id: args.deviceId,
      recording_id: rec.recordingId,
      original_filename: rec.originalFilename,
      relative_path: rec.relativePath,
      file_size: rec.fileSize ?? null,
      birthtime_ms: rec.birthtimeMs ?? null,
      mtime_ms: rec.mtimeMs ?? null,
      parsed_timestamp: rec.parsedTimestamp ?? null,
      raw_timestamp_text: rec.rawTimestampText ?? null,
      timezone: rec.timezone ?? timeZone,
      parse_source: rec.parseSource ?? null,
      parse_confidence: rec.parseConfidence ?? null,
      duration_seconds: rec.durationSeconds ?? null,
      container: rec.container ?? null,
      video_codec: rec.videoCodec ?? null,
      audio_codec: rec.audioCodec ?? null,
      width: rec.width ?? null,
      height: rec.height ?? null,
      has_audio: rec.hasAudio ?? null,
      availability: normalizeAvailability(rec.availability) as
        | "metadata-only"
        | "needs download"
        | "preparing"
        | "ready"
        | "unsupported"
        | "missing"
        | "error",
      playback_compatible: rec.playbackCompatible ?? null,
      needs_conversion: Boolean(rec.needsConversion),
      last_scan_at: rec.lastScanAt ?? args.lastScanAt ?? null,
      last_error: rec.lastError ?? null,
      display_title: displayTitle,
      match_status: (prior?.match_locked ? "manual" : match.matchStatus) as
        | "matched"
        | "needs_review"
        | "unmatched"
        | "manual",
      matched_event_id: prior?.match_locked ? prior.matched_event_id : match.matchedEventId,
      match_confidence: prior?.match_locked ? "high" : match.matchConfidence,
      match_reason: prior?.match_locked ? "Manually locked by staff." : match.matchReason,
      suggested_event_ids: match.suggestedEventIds,
    };

    const { data: upserted, error } = await admin
      .from("performance_recordings")
      .upsert(patch, { onConflict: "venue_id,recording_id" })
      .select("id, recording_id")
      .maybeSingle();

    if (error) {
      console.error("performance catalog upsert failed", error.message);
      continue;
    }
    if (upserted) upsertedIds.push(upserted.id);
  }

  // Second pass: Part labels for multi-recording events (only unlocked titles)
  for (const [eventId, group] of matchedGroups) {
    if (group.length < 2) continue;
    const labels = assignPartLabels(group);
    const event = eventById.get(eventId);
    for (const item of group) {
      const prior = existingByRecordingId.get(item.recordingId);
      if (prior?.display_title_locked) continue;
      const part = labels.get(item.recordingId);
      if (!part) continue;
      const title = buildPerformanceDisplayTitle({
        artistNames: event?.artistNames || [],
        eventTitle: event?.title,
        recordingTimestamp: item.parsedTimestamp,
        timeZone,
        partLabel: part,
        originalFilename: args.recordings.find((r) => r.recordingId === item.recordingId)?.originalFilename,
      });
      await admin
        .from("performance_recordings")
        .update({ display_title: title })
        .eq("venue_id", args.venueId)
        .eq("recording_id", item.recordingId)
        .eq("display_title_locked", false);
    }
  }

  await admin.from("performance_library_settings").upsert(
    {
      venue_id: args.venueId,
      device_id: args.deviceId,
      recordings_root: args.recordingsRoot ?? null,
      last_scan_at: args.lastScanAt ?? null,
      last_catalog_sync_at: new Date().toISOString(),
      catalog_count: args.recordings.length,
      scan_stats: {
        ...(args.scanStats || {}),
        nonVideoCount: args.nonVideoCount ?? 0,
        recordingsRootConfigured: args.recordingsRootConfigured,
      } as Json,
    },
    { onConflict: "venue_id" },
  );

  return { upserted: upsertedIds.length };
}
