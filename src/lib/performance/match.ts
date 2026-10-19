import { DateTime } from "luxon";
import { DEFAULT_VENUE_TIMEZONE } from "@/lib/constants";

export type MatchCandidateEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: string;
  archived_at: string | null;
  artistNames: string[];
};

export type RecordingMatchInput = {
  recordingId: string;
  parsedTimestamp: string | null;
  durationSeconds: number | null;
  parseConfidence: string | null;
  parseDateOnly?: boolean;
  matchLocked?: boolean;
  matchedEventId?: string | null;
};

export type RecordingMatchResult = {
  matchStatus: "matched" | "needs_review" | "unmatched" | "manual";
  matchedEventId: string | null;
  matchConfidence: "high" | "medium" | "low" | null;
  matchReason: string;
  suggestedEventIds: string[];
  cancelledReview: boolean;
};

const AFTER_MIDNIGHT_GRACE_MS = 6 * 60 * 60 * 1000; // recordings until 6am can belong to previous evening

function overlaps(
  recordingStartMs: number,
  recordingEndMs: number,
  eventStartMs: number,
  eventEndMs: number,
) {
  return recordingStartMs < eventEndMs && recordingEndMs > eventStartMs;
}

function scoreEvent(
  recordingStartMs: number,
  recordingEndMs: number,
  event: MatchCandidateEvent,
): { score: number; reason: string } {
  const eventStartMs = Date.parse(event.starts_at);
  const eventEndMs = Date.parse(event.ends_at);
  if (!Number.isFinite(eventStartMs) || !Number.isFinite(eventEndMs)) {
    return { score: 0, reason: "Invalid event times." };
  }

  if (overlaps(recordingStartMs, recordingEndMs, eventStartMs, eventEndMs)) {
    const contained =
      recordingStartMs >= eventStartMs - 5 * 60_000 && recordingEndMs <= eventEndMs + 15 * 60_000;
    if (contained) {
      return { score: 100, reason: "Recording interval falls inside the event window." };
    }
    return { score: 80, reason: "Recording overlaps the event window." };
  }

  // After-midnight: recording shortly after midnight may belong to previous evening show.
  const distanceAfterEnd = recordingStartMs - eventEndMs;
  if (distanceAfterEnd >= 0 && distanceAfterEnd <= AFTER_MIDNIGHT_GRACE_MS) {
    return {
      score: 70,
      reason: "Recording starts shortly after the event ended (after-midnight grace).",
    };
  }

  const distanceBeforeStart = eventStartMs - recordingStartMs;
  if (distanceBeforeStart >= 0 && distanceBeforeStart <= 30 * 60_000) {
    return { score: 60, reason: "Recording starts within 30 minutes before the event." };
  }

  // Same local calendar day weak signal
  return { score: 0, reason: "No temporal overlap." };
}

/**
 * Match a recording to historical events. Auto-link only when evidence clearly identifies one event.
 */
export function matchRecordingToEvents(
  recording: RecordingMatchInput,
  events: MatchCandidateEvent[],
  options?: { timeZone?: string },
): RecordingMatchResult {
  if (recording.matchLocked && recording.matchedEventId) {
    return {
      matchStatus: "manual",
      matchedEventId: recording.matchedEventId,
      matchConfidence: "high",
      matchReason: "Manually locked by staff.",
      suggestedEventIds: [],
      cancelledReview: false,
    };
  }

  if (!recording.parsedTimestamp) {
    return {
      matchStatus: "unmatched",
      matchedEventId: null,
      matchConfidence: null,
      matchReason: "No parseable recording timestamp.",
      suggestedEventIds: [],
      cancelledReview: false,
    };
  }

  const startMs = Date.parse(recording.parsedTimestamp);
  if (!Number.isFinite(startMs)) {
    return {
      matchStatus: "unmatched",
      matchedEventId: null,
      matchConfidence: null,
      matchReason: "Invalid parsed timestamp.",
      suggestedEventIds: [],
      cancelledReview: false,
    };
  }

  const durationMs = Math.max(0, Number(recording.durationSeconds) || 0) * 1000;
  // If duration unknown, assume a 45-minute window for overlap testing.
  const endMs = startMs + (durationMs || 45 * 60_000);

  if (recording.parseDateOnly || recording.parseConfidence === "low") {
    const day = DateTime.fromISO(recording.parsedTimestamp, { zone: "utc" }).setZone(
      options?.timeZone || DEFAULT_VENUE_TIMEZONE,
    );
    const dayStart = day.startOf("day").toUTC().toMillis();
    const dayEnd = day.endOf("day").toUTC().toMillis();
    const sameDay = events.filter((event) => {
      const s = Date.parse(event.starts_at);
      return s >= dayStart && s <= dayEnd;
    });
    const cancelled = sameDay.filter((e) => e.status === "cancelled");
    const active = sameDay.filter((e) => e.status !== "cancelled");
    if (active.length === 1 && cancelled.length === 0) {
      return {
        matchStatus: "needs_review",
        matchedEventId: null,
        matchConfidence: "low",
        matchReason: "Date-only filename; single event that day — needs review.",
        suggestedEventIds: [active[0].id],
        cancelledReview: false,
      };
    }
    return {
      matchStatus: "needs_review",
      matchedEventId: null,
      matchConfidence: "low",
      matchReason: "Date-only or low-confidence timestamp; cannot auto-match.",
      suggestedEventIds: [...active, ...cancelled].slice(0, 5).map((e) => e.id),
      cancelledReview: cancelled.length > 0,
    };
  }

  const scored = events
    .map((event) => {
      const { score, reason } = scoreEvent(startMs, endMs, event);
      return { event, score, reason };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) {
    return {
      matchStatus: "unmatched",
      matchedEventId: null,
      matchConfidence: null,
      matchReason: "No overlapping or nearby events.",
      suggestedEventIds: [],
      cancelledReview: false,
    };
  }

  // Cancelled events are review candidates only — never auto-linked.
  const active = scored.filter((row) => row.event.status !== "cancelled");
  const cancelled = scored.filter((row) => row.event.status === "cancelled");

  if (!active.length) {
    return {
      matchStatus: "needs_review",
      matchedEventId: null,
      matchConfidence: "medium",
      matchReason: `Best candidate is cancelled (${cancelled[0].reason})`,
      suggestedEventIds: scored.slice(0, 5).map((row) => row.event.id),
      cancelledReview: true,
    };
  }

  const top = active[0];
  const second = active[1];

  // Ambiguous: two strong active candidates within 15 points
  if (second && second.score >= 60 && top.score - second.score < 15) {
    return {
      matchStatus: "needs_review",
      matchedEventId: null,
      matchConfidence: "medium",
      matchReason: `Ambiguous: “${top.event.title}” (${top.score}) vs “${second.event.title}” (${second.score}).`,
      suggestedEventIds: scored.slice(0, 5).map((row) => row.event.id),
      cancelledReview: cancelled.length > 0,
    };
  }

  // Auto-match only with clear evidence against a non-cancelled event
  if (top.score >= 80 && (!second || top.score - second.score >= 15)) {
    return {
      matchStatus: "matched",
      matchedEventId: top.event.id,
      matchConfidence: top.score >= 100 ? "high" : "medium",
      matchReason:
        cancelled.length > 0
          ? `${top.reason} (cancelled overlaps ignored for auto-match)`
          : top.reason,
      suggestedEventIds: scored.slice(0, 5).map((row) => row.event.id),
      cancelledReview: false,
    };
  }

  return {
    matchStatus: "needs_review",
    matchedEventId: null,
    matchConfidence: "medium",
    matchReason: top.reason,
    suggestedEventIds: scored.slice(0, 5).map((row) => row.event.id),
    cancelledReview: cancelled.length > 0,
  };
}
