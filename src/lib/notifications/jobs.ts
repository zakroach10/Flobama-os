import type { Json } from "@/lib/database.types";
import { DateTime } from "luxon";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { DEFAULT_VENUE_TIMEZONE, FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { loadBookingInbox } from "@/lib/ghl/booking";
import { broadcastPushToVenue } from "@/lib/notifications/broadcast";

const BAND_CURSOR_KIND = "band_submissions";
const WEEKLY_CURSOR_KIND = "weekly_schedule";
const MAX_SEEN_IDS = 300;

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function diffNewBandSubmissionIds(currentIds: string[], seenIds: string[]): string[] {
  const seen = new Set(seenIds);
  return currentIds.filter((id) => !seen.has(id));
}

export function mergeSeenIds(previous: string[], currentIds: string[], max = MAX_SEEN_IDS): string[] {
  const merged = [...new Set([...currentIds, ...previous])];
  return merged.slice(0, max);
}

export function isMondayInVenueTz(now = new Date(), timeZone = DEFAULT_VENUE_TIMEZONE): boolean {
  return DateTime.fromJSDate(now, { zone: timeZone }).weekday === 1;
}

export function venueLocalDateKey(now = new Date(), timeZone = DEFAULT_VENUE_TIMEZONE): string {
  return DateTime.fromJSDate(now, { zone: timeZone }).toISODate() ?? "";
}

async function readCursor(venueId: string, kind: string): Promise<Record<string, unknown>> {
  const admin = createServiceRoleClient();
  if (!admin) return {};
  const { data } = await admin
    .from("push_notification_cursors")
    .select("cursor_json")
    .eq("venue_id", venueId)
    .eq("kind", kind)
    .maybeSingle();
  const raw = data?.cursor_json;
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

async function writeCursor(venueId: string, kind: string, cursor: Record<string, unknown>): Promise<string | null> {
  const admin = createServiceRoleClient();
  if (!admin) return "Service role is not configured.";
  const { error } = await admin.from("push_notification_cursors").upsert(
    {
      venue_id: venueId,
      kind,
      cursor_json: cursor as Json,
      last_run_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "venue_id,kind" },
  );
  return error?.message ?? null;
}

export async function notifyNewBandSubmissions(options?: {
  venueId?: string;
  forceIds?: string[];
  bandNamesById?: Record<string, string>;
}): Promise<{
  ok: boolean;
  message: string;
  newCount: number;
  notified: number;
  seeded: boolean;
}> {
  const venueId = options?.venueId ?? FLO_BAMA_VENUE_ID;
  const cursor = await readCursor(venueId, BAND_CURSOR_KIND);
  const seenIds = asStringArray(cursor.seenIds);
  const seededOnce = Boolean(cursor.seeded);

  let records: { id: string; displayName: string }[] = [];
  if (options?.forceIds?.length) {
    records = options.forceIds.map((id) => ({
      id,
      displayName: options.bandNamesById?.[id] ?? "New band submission",
    }));
  } else {
    const inbox = await loadBookingInbox("band_submission", { page: 1 });
    if (!inbox.configured) {
      return { ok: false, message: "GoHighLevel is not configured.", newCount: 0, notified: 0, seeded: false };
    }
    if (inbox.error) {
      return { ok: false, message: inbox.error, newCount: 0, notified: 0, seeded: false };
    }
    records = inbox.records.map((record) => ({ id: record.id, displayName: record.displayName }));
  }

  const currentIds = records.map((record) => record.id).filter(Boolean);
  const newIds = diffNewBandSubmissionIds(currentIds, seenIds);
  const nextSeen = mergeSeenIds(seenIds, currentIds);

  // First successful poll seeds without flooding every existing submission.
  if (!seededOnce && !options?.forceIds?.length) {
    const writeError = await writeCursor(venueId, BAND_CURSOR_KIND, { seenIds: nextSeen, seeded: true });
    if (writeError) {
      return { ok: false, message: writeError, newCount: 0, notified: 0, seeded: false };
    }
    return {
      ok: true,
      message: `Seeded ${nextSeen.length} existing band submission${nextSeen.length === 1 ? "" : "s"} (no notifications).`,
      newCount: 0,
      notified: 0,
      seeded: true,
    };
  }

  if (newIds.length === 0) {
    const writeError = await writeCursor(venueId, BAND_CURSOR_KIND, { seenIds: nextSeen, seeded: true });
    if (writeError) {
      return { ok: false, message: writeError, newCount: 0, notified: 0, seeded: false };
    }
    return { ok: true, message: "No new band submissions.", newCount: 0, notified: 0, seeded: false };
  }

  const byId = new Map(records.map((record) => [record.id, record.displayName]));
  let notified = 0;
  for (const id of newIds.slice(0, 10)) {
    const name = byId.get(id) ?? "New band submission";
    const result = await broadcastPushToVenue(
      {
        title: "New band submission",
        body: name,
        url: `/booking/submissions/${encodeURIComponent(id)}`,
      },
      venueId,
    );
    if (result.sent > 0) notified += 1;
  }

  const writeError = await writeCursor(venueId, BAND_CURSOR_KIND, { seenIds: nextSeen, seeded: true });
  if (writeError) {
    return { ok: false, message: writeError, newCount: newIds.length, notified, seeded: false };
  }

  return {
    ok: true,
    message: `Notified for ${newIds.length} new submission${newIds.length === 1 ? "" : "s"}.`,
    newCount: newIds.length,
    notified,
    seeded: false,
  };
}

export async function sendWeeklyScheduleReminder(options?: {
  venueId?: string;
  now?: Date;
  force?: boolean;
}): Promise<{ ok: boolean; message: string; sent: number; skipped: boolean }> {
  const venueId = options?.venueId ?? FLO_BAMA_VENUE_ID;
  const now = options?.now ?? new Date();
  const dateKey = venueLocalDateKey(now);

  if (!options?.force && !isMondayInVenueTz(now)) {
    return { ok: true, message: "Not Monday in venue timezone — skipped.", sent: 0, skipped: true };
  }

  const cursor = await readCursor(venueId, WEEKLY_CURSOR_KIND);
  const lastSentDate = typeof cursor.lastSentDate === "string" ? cursor.lastSentDate : "";
  if (!options?.force && lastSentDate === dateKey) {
    return { ok: true, message: "Monday reminder already sent today.", sent: 0, skipped: true };
  }

  const result = await broadcastPushToVenue(
    {
      title: "Post this week’s schedule",
      body: "Log into FloBama OS and publish the weekly Social graphic.",
      url: "/social/compose",
    },
    venueId,
  );

  if (!result.ok && !result.skipped) {
    return { ok: false, message: result.message, sent: result.sent, skipped: false };
  }

  const writeError = await writeCursor(venueId, WEEKLY_CURSOR_KIND, { lastSentDate: dateKey });
  if (writeError) {
    return { ok: false, message: writeError, sent: result.sent, skipped: false };
  }

  return {
    ok: true,
    message: result.skipped ? "No push subscribers for Monday reminder." : result.message,
    sent: result.sent,
    skipped: result.skipped,
  };
}

export function extractBandWebhookPayload(body: unknown): { id: string | null; name: string | null } {
  if (!body || typeof body !== "object") return { id: null, name: null };
  const record = body as Record<string, unknown>;
  const nested =
    (record.data && typeof record.data === "object" ? (record.data as Record<string, unknown>) : null) ??
    (record.record && typeof record.record === "object" ? (record.record as Record<string, unknown>) : null) ??
    (record.customData && typeof record.customData === "object"
      ? (record.customData as Record<string, unknown>)
      : null) ??
    record;

  const idCandidates = [nested.id, nested.recordId, nested.record_id, record.id, record.recordId];
  const nameCandidates = [
    nested.displayName,
    nested.bandName,
    nested.band_name,
    nested.name,
    nested.artist_band_name,
    record.bandName,
    record.name,
  ];

  const id =
    idCandidates.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim() ?? null;
  const name =
    nameCandidates.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim() ??
    null;
  return { id, name };
}
