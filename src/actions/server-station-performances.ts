"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  PERFORMANCE_LIBRARY_SQL,
  PERFORMANCE_SERVER_STATION_SQL,
} from "@/lib/constants";
import { freshestLedRunner } from "@/lib/display-devices/types";
import { enqueuePerformanceCommand } from "@/lib/performance/commands";
import {
  listPublishedStationPerformances,
  stationPerformanceLabel,
  type PublishedStationPerformance,
} from "@/lib/queries/performance-library";
import { listStaffDisplayDevices } from "@/lib/queries/display-devices";
import { getServerStationGate, writeServerStationAudit } from "@/lib/server-station/context";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type StationPerformanceActionResult = {
  ok: boolean;
  message: string;
  commandId?: string;
  performances?: PublishedStationPerformance[];
};

function revalidateStation() {
  revalidatePath("/server");
  revalidatePath("/server/performances");
  revalidatePath("/screens");
}

async function resolveLedRunner(venueId: string) {
  const admin = createServiceRoleClient();
  if (!admin) return { admin: null, deviceId: null as string | null };
  const devices = await listStaffDisplayDevices(admin, venueId);
  const runner = freshestLedRunner(devices.devices);
  return { admin, deviceId: runner?.id ?? null };
}

export async function listStationPublishedPerformancesAction(): Promise<StationPerformanceActionResult> {
  const gate = await getServerStationGate("access");
  if (!gate.ok) return { ok: false, message: gate.message };

  const result = await listPublishedStationPerformances(gate.writeClient, gate.venueId);
  if (result.missingTable) {
    return {
      ok: false,
      message: `Apply ${PERFORMANCE_SERVER_STATION_SQL} in Supabase, then reload.`,
      performances: [],
    };
  }
  if (result.error) return { ok: false, message: result.error, performances: [] };
  return { ok: true, message: "ok", performances: result.performances };
}

const playSchema = z.object({
  recordingRowId: z.string().uuid(),
});

export async function playStationPublishedPerformanceAction(
  input: z.infer<typeof playSchema>,
): Promise<StationPerformanceActionResult> {
  const gate = await getServerStationGate("access");
  if (!gate.ok) return { ok: false, message: gate.message };

  const parsed = playSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid recording." };

  const { data: row, error: loadError } = await gate.writeClient
    .from("performance_recordings")
    .select(
      "id, recording_id, display_title, server_station_title, original_filename, availability, server_station_published",
    )
    .eq("id", parsed.data.recordingRowId)
    .eq("venue_id", gate.venueId)
    .maybeSingle();

  if (loadError) {
    if (/server_station_published/i.test(loadError.message)) {
      return { ok: false, message: `Apply ${PERFORMANCE_SERVER_STATION_SQL} in Supabase, then retry.` };
    }
    return { ok: false, message: loadError.message };
  }
  if (!row) return { ok: false, message: "Recording not found." };
  if (!row.server_station_published) {
    return { ok: false, message: "That show is not published for Server Station." };
  }
  if (row.availability === "needs download") {
    return {
      ok: false,
      message: "This file is online-only in Dropbox. Ask a manager to make it available offline on the wall Mac.",
    };
  }
  if (row.availability === "preparing" || row.availability === "missing" || row.availability === "error") {
    return { ok: false, message: `This recording is not ready (${row.availability}).` };
  }
  if (row.availability === "unsupported") {
    return { ok: false, message: "This recording format is not supported on the LED wall." };
  }

  const { admin, deviceId } = await resolveLedRunner(gate.venueId);
  if (!admin || !deviceId) {
    return { ok: false, message: "No paired LED Local Runner is online. Pair the wall Mac first." };
  }

  const title = stationPerformanceLabel(row);
  const { command, error } = await enqueuePerformanceCommand(admin, {
    venueId: gate.venueId,
    deviceId,
    kind: "play_now",
    payload: { recordingId: row.recording_id, displayTitle: title },
    issuedBy: gate.actor.userId,
  });
  if (error) {
    if (/performance_commands/i.test(error)) {
      return { ok: false, message: `Apply ${PERFORMANCE_LIBRARY_SQL} in Supabase, then retry.` };
    }
    return { ok: false, message: error };
  }

  await writeServerStationAudit(gate.writeClient, {
    venueId: gate.venueId,
    actor: gate.actor,
    action: "performance.play",
    detail: {
      recordingRowId: row.id,
      recordingId: row.recording_id,
      title,
    },
  });

  revalidateStation();
  return { ok: true, message: `Playing “${title}” on the LED wall.`, commandId: command?.id };
}

export async function stopStationPerformanceAction(): Promise<StationPerformanceActionResult> {
  const gate = await getServerStationGate("access");
  if (!gate.ok) return { ok: false, message: gate.message };

  const { admin, deviceId } = await resolveLedRunner(gate.venueId);
  if (!admin || !deviceId) {
    return { ok: false, message: "No paired LED Local Runner is online." };
  }

  const { command, error } = await enqueuePerformanceCommand(admin, {
    venueId: gate.venueId,
    deviceId,
    kind: "stop_return_normal",
    payload: {},
    issuedBy: gate.actor.userId,
  });
  if (error) return { ok: false, message: error };

  await writeServerStationAudit(gate.writeClient, {
    venueId: gate.venueId,
    actor: gate.actor,
    action: "performance.stop",
    detail: {},
  });

  revalidateStation();
  return { ok: true, message: "Returning the wall to normal.", commandId: command?.id };
}

export async function pauseStationPerformanceAction(): Promise<StationPerformanceActionResult> {
  const gate = await getServerStationGate("access");
  if (!gate.ok) return { ok: false, message: gate.message };

  const { admin, deviceId } = await resolveLedRunner(gate.venueId);
  if (!admin || !deviceId) {
    return { ok: false, message: "No paired LED Local Runner is online." };
  }

  const { command, error } = await enqueuePerformanceCommand(admin, {
    venueId: gate.venueId,
    deviceId,
    kind: "pause",
    payload: {},
    issuedBy: gate.actor.userId,
  });
  if (error) return { ok: false, message: error };

  revalidateStation();
  return { ok: true, message: "Paused.", commandId: command?.id };
}

export async function resumeStationPerformanceAction(): Promise<StationPerformanceActionResult> {
  const gate = await getServerStationGate("access");
  if (!gate.ok) return { ok: false, message: gate.message };

  const { admin, deviceId } = await resolveLedRunner(gate.venueId);
  if (!admin || !deviceId) {
    return { ok: false, message: "No paired LED Local Runner is online." };
  }

  const { command, error } = await enqueuePerformanceCommand(admin, {
    venueId: gate.venueId,
    deviceId,
    kind: "resume",
    payload: {},
    issuedBy: gate.actor.userId,
  });
  if (error) return { ok: false, message: error };

  revalidateStation();
  return { ok: true, message: "Resumed.", commandId: command?.id };
}
