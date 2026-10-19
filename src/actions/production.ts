"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStaffContext } from "@/lib/auth/staff";
import {
  authorizeProductionConfigure,
  authorizeProductionControl,
  authorizeProductionView,
} from "@/lib/auth/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { enqueueProductionCommand } from "@/lib/production/commands";
import { ecammEndpointByName } from "@/lib/production/ecamm-endpoints";
import { PRODUCTION_ECAMM_SQL } from "@/lib/constants";
import { getProductionSettings } from "@/lib/queries/production";
import { listStaffDisplayDevices } from "@/lib/queries/display-devices";
import type { Json } from "@/lib/database.types";

export type ProductionActionResult = {
  ok: boolean;
  message: string;
  commandId?: string;
  sessionId?: string;
  markerId?: string;
};

function revalidate() {
  revalidatePath("/production");
  revalidatePath("/screens");
}

function sqlHint(message: string) {
  if (/production_/i.test(message)) {
    return `Apply ${PRODUCTION_ECAMM_SQL} in the Supabase SQL editor, then retry.`;
  }
  return message;
}

async function gate(mode: "view" | "control" | "configure") {
  const context = await getStaffContext();
  if (context.status === "unconfigured") return { ok: false as const, message: "Supabase is not configured." };
  if (context.status === "unauthenticated") return { ok: false as const, message: "Sign in required." };
  if (context.status === "denied") return { ok: false as const, message: "You do not have staff access." };
  if (context.status === "error") return { ok: false as const, message: context.message };
  const allowed =
    mode === "configure"
      ? authorizeProductionConfigure(context.role)
      : mode === "control"
        ? authorizeProductionControl(context.role)
        : authorizeProductionView(context.role);
  if (!allowed.allowed) return { ok: false as const, message: allowed.reason };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { ok: false as const, message: "Supabase is not configured." };
  return { ok: true as const, context, supabase };
}

async function resolveProductionDeviceId(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  venueId: string,
) {
  const settings = await getProductionSettings(supabase, venueId);
  if (settings.settings?.production_device_id) return settings.settings.production_device_id;

  const devices = await listStaffDisplayDevices(supabase, venueId);
  const production = devices.devices
    .filter((d) => d.kind === "production_runner" && !d.revoked_at)
    .sort((a, b) => Date.parse(b.last_seen_at || "") - Date.parse(a.last_seen_at || ""));
  if (production[0]) return production[0].id;

  const withEcamm = devices.devices.find(
    (d) => !d.revoked_at && d.kind === "led_runner",
  );
  return withEcamm?.id ?? null;
}

async function issue(
  mode: "control" | "configure",
  kind: Parameters<typeof enqueueProductionCommand>[1]["kind"],
  payload: Record<string, unknown> = {},
  endpoint?: string | null,
): Promise<ProductionActionResult> {
  const access = await gate(mode);
  if (!access.ok) return { ok: false, message: access.message };

  const deviceId = await resolveProductionDeviceId(access.supabase, access.context.venue.id);
  if (!deviceId) {
    return {
      ok: false,
      message: "No Production Local Runner is paired. Pair one under Screens → Display devices.",
    };
  }

  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, message: "Service role is not configured." };

  const settings = await getProductionSettings(access.supabase, access.context.venue.id);

  const { command, error } = await enqueueProductionCommand(admin, {
    venueId: access.context.venue.id,
    deviceId,
    kind,
    endpoint,
    payload,
    issuedBy: access.context.userId,
    allowPerBusMute: Boolean(settings.settings?.allow_per_bus_mute),
  });
  if (error) return { ok: false, message: sqlHint(error) };

  await admin.from("production_audit_log").insert({
    venue_id: access.context.venue.id,
    actor_user_id: access.context.userId,
    device_id: deviceId,
    action: `command:${kind}`,
    detail: { commandId: command?.id, endpoint, payload } as Json,
  });

  revalidate();
  return { ok: true, message: "Command queued for the Production runner.", commandId: command?.id };
}

export async function setProductionDeviceAction(deviceId: string | null): Promise<ProductionActionResult> {
  const access = await gate("configure");
  if (!access.ok) return { ok: false, message: access.message };
  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, message: "Service role is not configured." };

  if (deviceId) {
    const { data: device } = await admin
      .from("display_devices")
      .select("id, kind, revoked_at")
      .eq("id", deviceId)
      .eq("venue_id", access.context.venue.id)
      .maybeSingle();
    if (!device || device.revoked_at) return { ok: false, message: "Device was not found." };
  }

  const { error } = await admin.from("production_settings").upsert(
    {
      venue_id: access.context.venue.id,
      production_device_id: deviceId,
    },
    { onConflict: "venue_id" },
  );
  if (error) return { ok: false, message: sqlHint(error.message) };
  revalidate();
  return { ok: true, message: deviceId ? "Production device selected." : "Production device cleared." };
}

export async function discoverEcammAction(): Promise<ProductionActionResult> {
  return issue("configure", "ecamm_discover");
}

export async function selectEcammHostAction(input: {
  hostname: string;
  serviceName?: string | null;
  preferredAddress?: string | null;
}): Promise<ProductionActionResult> {
  const hostname = String(input.hostname || "").trim();
  if (!hostname) return { ok: false, message: "Hostname is required." };
  return issue("configure", "ecamm_select_host", {
    hostname,
    serviceName: input.serviceName ?? null,
    preferredAddress: input.preferredAddress ?? null,
  });
}

export async function forgetEcammHostAction(): Promise<ProductionActionResult> {
  return issue("configure", "ecamm_forget_host");
}

export async function refreshEcammAction(): Promise<ProductionActionResult> {
  return issue("control", "ecamm_refresh");
}

export async function enqueueEcammCallAction(
  endpoint: string,
  params: Record<string, unknown> = {},
): Promise<ProductionActionResult> {
  const access = await gate("control");
  if (!access.ok) return { ok: false, message: access.message };

  const def = ecammEndpointByName(endpoint.trim());
  if (!def) return { ok: false, message: `Unknown Ecamm endpoint: ${endpoint}` };
  if (def.permission === "admin_setup" || def.permission === "admin_diagnostics") {
    const cfg = authorizeProductionConfigure(access.context.role);
    if (!cfg.allowed) return { ok: false, message: cfg.reason };
  }

  return issue("control", "ecamm_call", { endpoint: endpoint.trim(), params }, endpoint.trim());
}

export async function createProductionSessionAction(input: {
  eventId?: string | null;
  artistIds?: string[];
  title?: string | null;
  notes?: string | null;
  setNumber?: number | null;
  startLive?: boolean;
}): Promise<ProductionActionResult> {
  const access = await gate("control");
  if (!access.ok) return { ok: false, message: access.message };
  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, message: "Service role is not configured." };

  const deviceId = await resolveProductionDeviceId(access.supabase, access.context.venue.id);
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("production_sessions")
    .insert({
      venue_id: access.context.venue.id,
      device_id: deviceId,
      event_id: input.eventId ?? null,
      artist_ids: input.artistIds ?? [],
      title: input.title?.trim() || null,
      notes: input.notes?.trim() || null,
      set_number: input.setNumber ?? null,
      status: input.startLive ? "live" : "planned",
      started_at: input.startLive ? now : null,
      created_by: access.context.userId,
    })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, message: sqlHint(error.message) };

  await admin.from("production_audit_log").insert({
    venue_id: access.context.venue.id,
    actor_user_id: access.context.userId,
    session_id: data?.id,
    action: "session_create",
    detail: { eventId: input.eventId ?? null } as Json,
  });

  revalidate();
  return { ok: true, message: "Production session created.", sessionId: data?.id };
}

export async function updateProductionSessionAction(input: {
  sessionId: string;
  title?: string | null;
  notes?: string | null;
  status?: "planned" | "live" | "recording" | "paused" | "ended" | "unassigned";
  setNumber?: number | null;
}): Promise<ProductionActionResult> {
  const access = await gate("control");
  if (!access.ok) return { ok: false, message: access.message };
  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, message: "Service role is not configured." };

  const patch: {
    title?: string | null;
    notes?: string | null;
    status?: "planned" | "live" | "recording" | "paused" | "ended" | "unassigned";
    set_number?: number | null;
    started_at?: string;
  } = {};
  if (input.title !== undefined) patch.title = input.title?.trim() || null;
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;
  if (input.status !== undefined) patch.status = input.status;
  if (input.setNumber !== undefined) patch.set_number = input.setNumber;
  if (input.status === "live" || input.status === "recording") {
    patch.started_at = new Date().toISOString();
  }

  const { error } = await admin
    .from("production_sessions")
    .update(patch)
    .eq("id", input.sessionId)
    .eq("venue_id", access.context.venue.id);
  if (error) return { ok: false, message: sqlHint(error.message) };
  revalidate();
  return { ok: true, message: "Session updated.", sessionId: input.sessionId };
}

export async function associateSessionEventAction(input: {
  sessionId: string;
  eventId: string | null;
  artistIds?: string[];
}): Promise<ProductionActionResult> {
  const access = await gate("control");
  if (!access.ok) return { ok: false, message: access.message };
  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, message: "Service role is not configured." };

  const patch: {
    event_id: string | null;
    artist_ids: string[];
    status?: "unassigned";
  } = {
    event_id: input.eventId,
    artist_ids: input.artistIds ?? [],
  };
  if (!input.eventId) patch.status = "unassigned";

  const { error } = await admin
    .from("production_sessions")
    .update(patch)
    .eq("id", input.sessionId)
    .eq("venue_id", access.context.venue.id);
  if (error) return { ok: false, message: sqlHint(error.message) };

  const deviceId = await resolveProductionDeviceId(access.supabase, access.context.venue.id);
  if (deviceId) {
    await enqueueProductionCommand(admin, {
      venueId: access.context.venue.id,
      deviceId,
      kind: "recording_associate",
      payload: { sessionId: input.sessionId, eventId: input.eventId },
      issuedBy: access.context.userId,
    });
  }

  revalidate();
  return { ok: true, message: "Session linked to event.", sessionId: input.sessionId };
}

export async function endProductionSessionAction(sessionId: string): Promise<ProductionActionResult> {
  const access = await gate("control");
  if (!access.ok) return { ok: false, message: access.message };
  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, message: "Service role is not configured." };

  const now = new Date().toISOString();
  const { error } = await admin
    .from("production_sessions")
    .update({ status: "ended", ended_at: now })
    .eq("id", sessionId)
    .eq("venue_id", access.context.venue.id);
  if (error) return { ok: false, message: sqlHint(error.message) };
  revalidate();
  return { ok: true, message: "Session ended.", sessionId };
}

export async function createMarkerAction(input: {
  sessionId: string;
  label?: string;
  notes?: string | null;
}): Promise<ProductionActionResult> {
  const access = await gate("control");
  if (!access.ok) return { ok: false, message: access.message };
  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, message: "Service role is not configured." };

  const label = (input.label || "Highlight").trim().slice(0, 200) || "Highlight";
  const now = new Date().toISOString();

  const { data: session } = await admin
    .from("production_sessions")
    .select("id, started_at, recording_started_at")
    .eq("id", input.sessionId)
    .eq("venue_id", access.context.venue.id)
    .maybeSingle();
  if (!session) return { ok: false, message: "Session was not found." };

  const anchor = session.recording_started_at || session.started_at;
  const relativeSeconds = anchor ? (Date.parse(now) - Date.parse(anchor)) / 1000 : null;

  const { data: marker, error } = await admin
    .from("production_markers")
    .insert({
      venue_id: access.context.venue.id,
      session_id: input.sessionId,
      label,
      notes: input.notes?.trim() || null,
      marked_at: now,
      relative_seconds: relativeSeconds,
      os_saved: true,
      ecamm_status: "queued",
      created_by: access.context.userId,
    })
    .select("id")
    .maybeSingle();
  if (error || !marker) return { ok: false, message: sqlHint(error?.message || "Could not save marker.") };

  const deviceId = await resolveProductionDeviceId(access.supabase, access.context.venue.id);
  if (deviceId) {
    const { command, error: cmdError } = await enqueueProductionCommand(admin, {
      venueId: access.context.venue.id,
      deviceId,
      kind: "ecamm_call",
      endpoint: "setMarker",
      payload: { endpoint: "setMarker", params: {} },
      issuedBy: access.context.userId,
    });
    if (cmdError) {
      await admin
        .from("production_markers")
        .update({ ecamm_status: "failed", ecamm_error: cmdError })
        .eq("id", marker.id);
      revalidate();
      return {
        ok: true,
        message: "Marker saved in FloBama OS. Ecamm queue failed — OS marker kept.",
        markerId: marker.id,
      };
    }
    await admin
      .from("production_markers")
      .update({ ecamm_command_id: command?.id ?? null, ecamm_status: "queued" })
      .eq("id", marker.id);
  } else {
    await admin
      .from("production_markers")
      .update({ ecamm_status: "not_sent", ecamm_error: "No production device paired." })
      .eq("id", marker.id);
  }

  revalidate();
  return { ok: true, message: "Marker saved. Ecamm setMarker queued.", markerId: marker.id };
}

export async function setAllowPerBusMuteAction(allow: boolean): Promise<ProductionActionResult> {
  const access = await gate("configure");
  if (!access.ok) return { ok: false, message: access.message };
  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, message: "Service role is not configured." };

  const { error } = await admin.from("production_settings").upsert(
    {
      venue_id: access.context.venue.id,
      allow_per_bus_mute: Boolean(allow),
    },
    { onConflict: "venue_id" },
  );
  if (error) return { ok: false, message: sqlHint(error.message) };

  const pushed = await issue("configure", "ecamm_refresh", { allowPerBusMute: Boolean(allow) });
  if (!pushed.ok && !/No Production Local Runner/i.test(pushed.message)) {
    return { ok: false, message: pushed.message };
  }

  revalidate();
  return {
    ok: true,
    message: allow
      ? "Per-bus mute enabled (undocumented Ecamm behavior — use after venue testing)."
      : "Per-bus mute disabled.",
    commandId: pushed.commandId,
  };
}

export async function setSceneFavoritesAction(input: {
  scenes?: string[];
  overlays?: string[];
}): Promise<ProductionActionResult> {
  const access = await gate("configure");
  if (!access.ok) return { ok: false, message: access.message };
  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, message: "Service role is not configured." };

  const scenes = (input.scenes ?? []).map(String).slice(0, 40);
  const overlays = (input.overlays ?? []).map(String).slice(0, 40);

  const { error } = await admin.from("production_settings").upsert(
    {
      venue_id: access.context.venue.id,
      scene_favorites: scenes as unknown as Json,
      overlay_favorites: overlays as unknown as Json,
    },
    { onConflict: "venue_id" },
  );
  if (error) return { ok: false, message: sqlHint(error.message) };

  await issue("configure", "ecamm_refresh", { favorites: { scenes, overlays } });

  revalidate();
  return { ok: true, message: "Favorites saved." };
}

const diagnosticsSchema = z.object({
  endpoint: z.string().trim().min(1).max(80),
  params: z.record(z.string(), z.any()).optional(),
  asAction: z.boolean().optional(),
});

export async function enqueueDiagnosticsProbeAction(
  input: z.infer<typeof diagnosticsSchema>,
): Promise<ProductionActionResult> {
  const access = await gate("configure");
  if (!access.ok) return { ok: false, message: access.message };
  const parsed = diagnosticsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the probe fields." };
  return issue(
    "configure",
    "ecamm_diagnostics_probe",
    {
      endpoint: parsed.data.endpoint,
      params: parsed.data.params || {},
      asAction: parsed.data.asAction,
    },
    parsed.data.endpoint,
  );
}
