"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStaffContext } from "@/lib/auth/staff";
import {
  authorizePerformanceConfigure,
  authorizePerformancePlayback,
} from "@/lib/auth/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { enqueuePerformanceCommand } from "@/lib/performance/commands";
import { buildPerformanceDisplayTitle } from "@/lib/performance/titles";
import { artistNames, getEventById } from "@/lib/queries/events";
import { freshestLedRunner } from "@/lib/display-devices/types";
import { listStaffDisplayDevices } from "@/lib/queries/display-devices";
import {
  PERFORMANCE_LIBRARY_SQL,
  PERFORMANCE_SERVER_STATION_SQL,
} from "@/lib/constants";
import { stationPerformanceLabel } from "@/lib/queries/performance-library";

export type PerformanceActionResult = {
  ok: boolean;
  message: string;
  commandId?: string;
};

function revalidate() {
  revalidatePath("/screens");
  revalidatePath("/server");
  revalidatePath("/server/performances");
}

async function gate(mode: "playback" | "configure") {
  const context = await getStaffContext();
  if (context.status === "unconfigured") return { ok: false as const, message: "Supabase is not configured." };
  if (context.status === "unauthenticated") return { ok: false as const, message: "Sign in required." };
  if (context.status === "denied") return { ok: false as const, message: "You do not have staff access." };
  if (context.status === "error") return { ok: false as const, message: context.message };
  const allowed =
    mode === "configure"
      ? authorizePerformanceConfigure(context.role)
      : authorizePerformancePlayback(context.role, context.email, {
          userId: context.userId,
          wallOpsUserId: context.venue.wall_ops_user_id,
        });
  if (!allowed.allowed) return { ok: false as const, message: allowed.reason };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { ok: false as const, message: "Supabase is not configured." };
  return { ok: true as const, context, supabase };
}

async function resolveLedRunnerDeviceId(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, venueId: string) {
  if (!supabase) return null;
  const devices = await listStaffDisplayDevices(supabase, venueId);
  const runner = freshestLedRunner(devices.devices);
  return runner?.id ?? null;
}

async function issue(
  mode: "playback" | "configure",
  kind: Parameters<typeof enqueuePerformanceCommand>[1]["kind"],
  payload: Record<string, unknown> = {},
): Promise<PerformanceActionResult> {
  const access = await gate(mode);
  if (!access.ok) return { ok: false, message: access.message };

  const deviceId = await resolveLedRunnerDeviceId(access.supabase, access.context.venue.id);
  if (!deviceId) {
    return { ok: false, message: "No paired LED Local Runner is online. Pair the wall Mac first." };
  }

  // Use service role so command insert is reliable even if RLS membership edge cases arise.
  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, message: "Service role is not configured." };

  const { command, error } = await enqueuePerformanceCommand(admin, {
    venueId: access.context.venue.id,
    deviceId,
    kind,
    payload,
    issuedBy: access.context.userId,
  });
  if (error) {
    if (/performance_commands/i.test(error)) {
      return { ok: false, message: `Apply ${PERFORMANCE_LIBRARY_SQL} in Supabase, then retry.` };
    }
    return { ok: false, message: error };
  }
  revalidate();
  return { ok: true, message: "Command queued for the Local Runner.", commandId: command?.id };
}

export async function scanPerformanceLibraryAction(): Promise<PerformanceActionResult> {
  return issue("configure", "scan_recordings");
}

export async function setRecordingsRootAction(formData: FormData): Promise<PerformanceActionResult> {
  const root = String(formData.get("recordingsRoot") || "").trim();
  if (!root) return { ok: false, message: "Enter the recordings folder path." };
  return issue("configure", "set_recordings_root", { recordingsRoot: root, timezone: "America/Chicago" });
}

export async function prepareRecordingAction(recordingId: string): Promise<PerformanceActionResult> {
  if (!recordingId) return { ok: false, message: "Missing recording id." };
  return issue("playback", "prepare_recording", { recordingId });
}

export async function playNowAction(recordingId: string, displayTitle?: string | null): Promise<PerformanceActionResult> {
  return issue("playback", "play_now", { recordingId, displayTitle: displayTitle || null });
}

export async function playNextAction(recordingId: string, displayTitle?: string | null): Promise<PerformanceActionResult> {
  return issue("playback", "play_next", { recordingId, displayTitle: displayTitle || null });
}

export async function addToQueueAction(recordingId: string, displayTitle?: string | null): Promise<PerformanceActionResult> {
  return issue("playback", "queue_add", { recordingId, displayTitle: displayTitle || null });
}

export async function removeFromQueueAction(queueItemId: string): Promise<PerformanceActionResult> {
  return issue("playback", "queue_remove", { queueItemId });
}

export async function reorderQueueAction(queueItemIds: string[]): Promise<PerformanceActionResult> {
  return issue("playback", "queue_reorder", { queueItemIds });
}

export async function pausePerformanceAction(): Promise<PerformanceActionResult> {
  return issue("playback", "pause");
}

export async function resumePerformanceAction(): Promise<PerformanceActionResult> {
  return issue("playback", "resume");
}

export async function seekPerformanceAction(positionSeconds: number): Promise<PerformanceActionResult> {
  return issue("playback", "seek", { positionSeconds });
}

export async function skipPerformanceAction(): Promise<PerformanceActionResult> {
  return issue("playback", "skip");
}

export async function setPerformanceAudioMutedAction(muted: boolean): Promise<PerformanceActionResult> {
  return issue("playback", "set_audio_muted", { muted });
}

export async function stopReturnToNormalWallAction(): Promise<PerformanceActionResult> {
  return issue("playback", "stop_return_normal");
}

const updateMatchSchema = z.object({
  recordingRowId: z.string().uuid(),
  eventId: z.string().uuid().nullable(),
  lock: z.boolean().optional(),
});

export async function updateRecordingMatchAction(input: z.infer<typeof updateMatchSchema>): Promise<PerformanceActionResult> {
  const access = await gate("configure");
  if (!access.ok) return { ok: false, message: access.message };
  const parsed = updateMatchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the match fields." };

  const { data: row, error: loadError } = await access.supabase
    .from("performance_recordings")
    .select("*")
    .eq("id", parsed.data.recordingRowId)
    .eq("venue_id", access.context.venue.id)
    .maybeSingle();
  if (loadError || !row) return { ok: false, message: loadError?.message || "Recording not found." };

  let displayTitle = row.display_title;
  if (parsed.data.eventId) {
    const { event } = await getEventById(access.supabase, parsed.data.eventId);
    if (event) {
      displayTitle = buildPerformanceDisplayTitle({
        artistNames: artistNames(event),
        eventTitle: event.title,
        recordingTimestamp: row.parsed_timestamp,
        timeZone: row.timezone || access.context.venue.timezone,
        originalFilename: row.original_filename,
      });
    }
  }

  const { error } = await access.supabase
    .from("performance_recordings")
    .update({
      matched_event_id: parsed.data.eventId,
      match_status: parsed.data.eventId ? "manual" : "unmatched",
      match_locked: parsed.data.lock !== false && Boolean(parsed.data.eventId),
      match_confidence: parsed.data.eventId ? "high" : null,
      match_reason: parsed.data.eventId ? "Manually assigned by staff." : "Cleared by staff.",
      display_title: displayTitle,
    })
    .eq("id", row.id);
  if (error) return { ok: false, message: error.message };
  revalidate();
  return { ok: true, message: "Match updated and locked against rescans." };
}

const updateTitleSchema = z.object({
  recordingRowId: z.string().uuid(),
  displayTitle: z.string().trim().min(1).max(300),
  lock: z.boolean().optional(),
});

export async function updateRecordingTitleAction(input: z.infer<typeof updateTitleSchema>): Promise<PerformanceActionResult> {
  const access = await gate("configure");
  if (!access.ok) return { ok: false, message: access.message };
  const parsed = updateTitleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Enter a display title." };

  const { error } = await access.supabase
    .from("performance_recordings")
    .update({
      display_title: parsed.data.displayTitle,
      display_title_locked: parsed.data.lock !== false,
    })
    .eq("id", parsed.data.recordingRowId)
    .eq("venue_id", access.context.venue.id);
  if (error) return { ok: false, message: error.message };
  revalidate();
  return { ok: true, message: "Display title saved (source filename unchanged)." };
}

const publishSchema = z.object({
  recordingRowId: z.string().uuid(),
  stationTitle: z.string().trim().min(1).max(120).nullable().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});

export async function publishRecordingToServerStationAction(
  input: z.infer<typeof publishSchema>,
): Promise<PerformanceActionResult> {
  const access = await gate("configure");
  if (!access.ok) return { ok: false, message: access.message };
  const parsed = publishSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the publish fields." };

  const { data: row, error: loadError } = await access.supabase
    .from("performance_recordings")
    .select("id, display_title, original_filename, server_station_title")
    .eq("id", parsed.data.recordingRowId)
    .eq("venue_id", access.context.venue.id)
    .maybeSingle();
  if (loadError || !row) {
    if (loadError && /server_station_published/i.test(loadError.message)) {
      return { ok: false, message: `Apply ${PERFORMANCE_SERVER_STATION_SQL} in Supabase, then retry.` };
    }
    return { ok: false, message: loadError?.message || "Recording not found." };
  }

  const stationTitle =
    parsed.data.stationTitle === undefined
      ? row.server_station_title
      : parsed.data.stationTitle;

  const { error } = await access.supabase
    .from("performance_recordings")
    .update({
      server_station_published: true,
      server_station_title: stationTitle,
      server_station_sort_order: parsed.data.sortOrder ?? 0,
      server_station_published_at: new Date().toISOString(),
      server_station_published_by: access.context.userId,
    })
    .eq("id", row.id)
    .eq("venue_id", access.context.venue.id);

  if (error) {
    if (/server_station_published|server_station_title/i.test(error.message)) {
      return { ok: false, message: `Apply ${PERFORMANCE_SERVER_STATION_SQL} in Supabase, then retry.` };
    }
    return { ok: false, message: error.message };
  }

  revalidate();
  const label = stationPerformanceLabel({
    server_station_title: stationTitle,
    display_title: row.display_title,
    original_filename: row.original_filename,
  });
  return { ok: true, message: `Published “${label}” to Server Station.` };
}

export async function unpublishRecordingFromServerStationAction(
  recordingRowId: string,
): Promise<PerformanceActionResult> {
  const access = await gate("configure");
  if (!access.ok) return { ok: false, message: access.message };
  if (!z.string().uuid().safeParse(recordingRowId).success) {
    return { ok: false, message: "Invalid recording." };
  }

  const { error } = await access.supabase
    .from("performance_recordings")
    .update({
      server_station_published: false,
      server_station_published_at: null,
      server_station_published_by: null,
    })
    .eq("id", recordingRowId)
    .eq("venue_id", access.context.venue.id);

  if (error) {
    if (/server_station_published/i.test(error.message)) {
      return { ok: false, message: `Apply ${PERFORMANCE_SERVER_STATION_SQL} in Supabase, then retry.` };
    }
    return { ok: false, message: error.message };
  }
  revalidate();
  return { ok: true, message: "Removed from Server Station." };
}

const renameStationSchema = z.object({
  recordingRowId: z.string().uuid(),
  stationTitle: z.string().trim().min(1).max(120),
});

/** Rename the Server Station label only — Dropbox filename stays unchanged. */
export async function renameServerStationPerformanceAction(
  input: z.infer<typeof renameStationSchema>,
): Promise<PerformanceActionResult> {
  const access = await gate("configure");
  if (!access.ok) return { ok: false, message: access.message };
  const parsed = renameStationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Enter a name (1–120 characters)." };

  const { error } = await access.supabase
    .from("performance_recordings")
    .update({
      server_station_title: parsed.data.stationTitle,
    })
    .eq("id", parsed.data.recordingRowId)
    .eq("venue_id", access.context.venue.id);

  if (error) {
    if (/server_station_title/i.test(error.message)) {
      return { ok: false, message: `Apply ${PERFORMANCE_SERVER_STATION_SQL} in Supabase, then retry.` };
    }
    return { ok: false, message: error.message };
  }
  revalidate();
  return { ok: true, message: "Server Station name saved (source filename unchanged)." };
}
