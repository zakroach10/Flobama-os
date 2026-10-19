import { DateTime } from "luxon";
import { DEFAULT_VENUE_TIMEZONE } from "@/lib/constants";

export type TitleInput = {
  artistNames: string[];
  eventTitle?: string | null;
  recordingTimestamp: string | null;
  timeZone?: string;
  partLabel?: string | null;
  originalFilename?: string | null;
};

/**
 * Friendly OS display title. Never renames the source file.
 * Example: “Artist Name — Live at FloBama — Oct 17, 2026 — 9:30 PM”
 */
export function buildPerformanceDisplayTitle(input: TitleInput): string {
  const tz = input.timeZone || DEFAULT_VENUE_TIMEZONE;
  const when = input.recordingTimestamp
    ? DateTime.fromISO(input.recordingTimestamp, { zone: "utc" }).setZone(tz)
    : null;

  const datePart = when?.isValid ? when.toFormat("LLL d, yyyy") : null;
  const timePart = when?.isValid ? when.toFormat("h:mm a") : null;

  const artist =
    input.artistNames.filter(Boolean).join(", ") ||
    input.eventTitle?.trim() ||
    null;

  if (artist && datePart && timePart) {
    const base = `${artist} — Live at FloBama — ${datePart} — ${timePart}`;
    return input.partLabel ? `${base} (${input.partLabel})` : base;
  }

  if (datePart && timePart) {
    const base = `Recording — ${datePart} — ${timePart}`;
    return input.originalFilename ? `${base} · ${input.originalFilename}` : base;
  }

  if (datePart) {
    const base = `Recording — ${datePart}`;
    return input.originalFilename ? `${base} · ${input.originalFilename}` : base;
  }

  return input.originalFilename || "Untitled recording";
}

/**
 * Assign Part 1 / Part 2 only when multiple recordings share an event and are chronological.
 */
export function assignPartLabels(
  recordings: Array<{ recordingId: string; parsedTimestamp: string | null }>,
): Map<string, string | null> {
  const labels = new Map<string, string | null>();
  const dated = recordings
    .filter((r) => r.parsedTimestamp)
    .sort((a, b) => String(a.parsedTimestamp).localeCompare(String(b.parsedTimestamp)));
  if (dated.length < 2) {
    for (const r of recordings) labels.set(r.recordingId, null);
    return labels;
  }
  dated.forEach((r, index) => {
    labels.set(r.recordingId, `Part ${index + 1}`);
  });
  for (const r of recordings) {
    if (!labels.has(r.recordingId)) labels.set(r.recordingId, null);
  }
  return labels;
}
