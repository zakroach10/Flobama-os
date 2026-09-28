"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStaffContext } from "@/lib/auth/staff";
import { authorizeLedWallActivate, authorizeLedWallConfigure } from "@/lib/auth/permissions";
import { LED_WALL_SHOWTIME_SQL, LED_WALL_SQL } from "@/lib/constants";
import { createLedAgentToken, hashLedAgentToken, isMissingLedWallRelation } from "@/lib/screens/led-wall";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  activateLedWallSceneSchema,
  createLedMediaSceneSchema,
  createLedObsSceneSchema,
  ledWallMediaSceneNameSchema,
  reorderLedWallScenesSchema,
  updateLedWallSceneSchema,
  assignArtistLedWallSchema,
} from "@/lib/validation/schemas";

export type LedWallActionResult = { ok: boolean; message: string; token?: string };

function fieldMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Check the highlighted fields.";
}

function ledSqlMessage(message: string) {
  if (isMissingLedWallRelation(message)) {
    return `Apply ${LED_WALL_SQL} and ${LED_WALL_SHOWTIME_SQL} in the Supabase SQL editor, then try again.`;
  }
  if (/only admins can assign/i.test(message)) return "Only admins can assign an LED wall configuration.";
  if (/not available/i.test(message)) return "That scene is not available.";
  return message;
}

async function staffGate(configure: boolean) {
  const context = await getStaffContext();
  if (context.status === "unconfigured") return { ok: false as const, message: "Supabase is not configured." };
  if (context.status === "unauthenticated") return { ok: false as const, message: "Sign in required." };
  if (context.status === "denied") return { ok: false as const, message: "You do not have staff access." };
  if (context.status === "error") return { ok: false as const, message: context.message };
  const allowed = configure ? authorizeLedWallConfigure(context.role) : authorizeLedWallActivate(context.role);
  if (!allowed.allowed) return { ok: false as const, message: allowed.reason };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { ok: false as const, message: "Supabase is not configured." };
  return { ok: true as const, context, supabase };
}

function revalidateLedWall() {
  revalidatePath("/screens");
  revalidatePath("/display/led");
  revalidatePath("/api/public/v1/screens/led");
}

async function nextSortOrder(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, venueId: string) {
  if (!supabase) return 0;
  const { count } = await supabase
    .from("led_wall_scenes")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", venueId);
  return count ?? 0;
}

export async function activateLedWallSceneAction(input: unknown): Promise<LedWallActionResult> {
  const gate = await staffGate(false);
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = activateLedWallSceneSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  const { data: scene, error: sceneError } = await gate.supabase
    .from("led_wall_scenes")
    .select("id, title, enabled")
    .eq("id", parsed.data.sceneId)
    .eq("venue_id", gate.context.venue.id)
    .maybeSingle();
  if (sceneError) return { ok: false, message: ledSqlMessage(sceneError.message) };
  if (!scene || !scene.enabled) return { ok: false, message: "That scene is not available." };

  const { error } = await gate.supabase.from("led_wall_runtime").upsert(
    {
      venue_id: gate.context.venue.id,
      active_scene_id: scene.id,
    },
    { onConflict: "venue_id" },
  );
  if (error) return { ok: false, message: ledSqlMessage(error.message) };
  revalidateLedWall();
  return { ok: true, message: `${scene.title} is the active LED wall scene.` };
}

export async function createLedObsSceneAction(input: unknown): Promise<LedWallActionResult> {
  const gate = await staffGate(true);
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = createLedObsSceneSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  const { error } = await gate.supabase.from("led_wall_scenes").insert({
    venue_id: gate.context.venue.id,
    title: parsed.data.title,
    kind: "obs",
    obs_scene_name: parsed.data.obsSceneName,
    sort_order: await nextSortOrder(gate.supabase, gate.context.venue.id),
    enabled: true,
  });
  if (error) return { ok: false, message: ledSqlMessage(error.message) };
  revalidateLedWall();
  return { ok: true, message: `${parsed.data.title} was added.` };
}

async function clearAdRoll(supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>, venueId: string, exceptId?: string) {
  let query = supabase.from("led_wall_scenes").update({ rolls_until_showtime: false }).eq("venue_id", venueId).eq("rolls_until_showtime", true);
  if (exceptId) query = query.neq("id", exceptId);
  return query;
}

export async function createLedMediaSceneAction(input: unknown): Promise<LedWallActionResult> {
  const gate = await staffGate(true);
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = createLedMediaSceneSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  if (parsed.data.rollsUntilShowtime) {
    const { error: clearError } = await clearAdRoll(gate.supabase, gate.context.venue.id);
    if (clearError) return { ok: false, message: ledSqlMessage(clearError.message) };
  }

  const { error } = await gate.supabase.from("led_wall_scenes").insert({
    id: parsed.data.id,
    venue_id: gate.context.venue.id,
    title: parsed.data.title,
    kind: "media",
    media_kind: parsed.data.mediaKind,
    storage_path: parsed.data.storagePath,
    public_url: parsed.data.publicUrl,
    sort_order: await nextSortOrder(gate.supabase, gate.context.venue.id),
    enabled: true,
    rolls_until_showtime: parsed.data.rollsUntilShowtime,
  });
  if (error) return { ok: false, message: ledSqlMessage(error.message) };
  revalidateLedWall();
  return { ok: true, message: `${parsed.data.title} was added.` };
}

export async function updateLedWallSceneAction(input: unknown): Promise<LedWallActionResult> {
  const gate = await staffGate(true);
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = updateLedWallSceneSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  if (parsed.data.rollsUntilShowtime === true) {
    const { data: scene, error: sceneError } = await gate.supabase
      .from("led_wall_scenes")
      .select("id, kind, media_kind")
      .eq("id", parsed.data.id)
      .eq("venue_id", gate.context.venue.id)
      .maybeSingle();
    if (sceneError) return { ok: false, message: ledSqlMessage(sceneError.message) };
    if (!scene || scene.kind !== "media" || scene.media_kind !== "video") {
      return { ok: false, message: "Only an MP4 can roll until showtime." };
    }
    const { error: clearError } = await clearAdRoll(gate.supabase, gate.context.venue.id, scene.id);
    if (clearError) return { ok: false, message: ledSqlMessage(clearError.message) };
  }

  const { error } = await gate.supabase
    .from("led_wall_scenes")
    .update({
      title: parsed.data.title,
      enabled: parsed.data.enabled,
      ...(parsed.data.rollsUntilShowtime === undefined ? {} : { rolls_until_showtime: parsed.data.rollsUntilShowtime }),
    })
    .eq("id", parsed.data.id)
    .eq("venue_id", gate.context.venue.id);
  if (error) return { ok: false, message: ledSqlMessage(error.message) };
  revalidateLedWall();
  return { ok: true, message: "Scene updated." };
}

export async function reorderLedWallScenesAction(input: unknown): Promise<LedWallActionResult> {
  const gate = await staffGate(true);
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = reorderLedWallScenesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  for (const [index, id] of parsed.data.ids.entries()) {
    const { error } = await gate.supabase
      .from("led_wall_scenes")
      .update({ sort_order: index })
      .eq("id", id)
      .eq("venue_id", gate.context.venue.id);
    if (error) return { ok: false, message: ledSqlMessage(error.message) };
  }
  revalidateLedWall();
  return { ok: true, message: "Scene order saved." };
}

export async function deleteLedWallSceneAction(id: string): Promise<LedWallActionResult> {
  const gate = await staffGate(true);
  if (!gate.ok) return { ok: false, message: gate.message };

  const { data: scene, error: sceneError } = await gate.supabase
    .from("led_wall_scenes")
    .select("id, storage_path, title")
    .eq("id", id)
    .eq("venue_id", gate.context.venue.id)
    .maybeSingle();
  if (sceneError) return { ok: false, message: ledSqlMessage(sceneError.message) };
  if (!scene) return { ok: false, message: "That scene is already gone." };

  const { error } = await gate.supabase.from("led_wall_scenes").delete().eq("id", scene.id).eq("venue_id", gate.context.venue.id);
  if (error) return { ok: false, message: ledSqlMessage(error.message) };
  if (scene.storage_path) {
    await gate.supabase.storage.from("screen-ads").remove([scene.storage_path]);
  }
  revalidateLedWall();
  return { ok: true, message: `${scene.title} was removed.` };
}

export async function saveLedWallMediaSceneAction(input: unknown): Promise<LedWallActionResult> {
  const gate = await staffGate(true);
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = ledWallMediaSceneNameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  const { error } = await gate.supabase.from("led_wall_settings").upsert(
    {
      venue_id: gate.context.venue.id,
      media_obs_scene_name: parsed.data.mediaObsSceneName,
    },
    { onConflict: "venue_id" },
  );
  if (error) return { ok: false, message: ledSqlMessage(error.message) };
  revalidateLedWall();
  return { ok: true, message: "Media browser scene saved." };
}

export async function issueLedWallAgentTokenAction(): Promise<LedWallActionResult> {
  const gate = await staffGate(true);
  if (!gate.ok) return { ok: false, message: gate.message };
  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, message: "Set SUPABASE_SERVICE_ROLE_KEY on the server before issuing a booth token." };
  }

  const token = createLedAgentToken();
  const { error: secretError } = await admin.from("led_wall_agent_secrets").upsert(
    {
      venue_id: gate.context.venue.id,
      token_hash: hashLedAgentToken(token),
    },
    { onConflict: "venue_id" },
  );
  if (secretError) return { ok: false, message: ledSqlMessage(secretError.message) };

  const { error } = await gate.supabase.from("led_wall_settings").upsert(
    {
      venue_id: gate.context.venue.id,
      agent_token_issued_at: new Date().toISOString(),
    },
    { onConflict: "venue_id" },
  );
  if (error) return { ok: false, message: ledSqlMessage(error.message) };
  revalidateLedWall();
  return {
    ok: true,
    token,
    message: "Booth token created. Copy it into the client config now. It will not be shown again.",
  };
}

export async function assignArtistLedWallAction(input: unknown): Promise<LedWallActionResult> {
  const gate = await staffGate(true);
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = assignArtistLedWallSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  const { error } = await gate.supabase
    .from("artists")
    .update({ led_wall_scene_id: parsed.data.sceneId })
    .eq("id", parsed.data.artistId)
    .eq("venue_id", gate.context.venue.id);
  if (error) return { ok: false, message: ledSqlMessage(error.message) };
  revalidateLedWall();
  revalidatePath("/dashboard");
  revalidatePath("/events");
  revalidatePath(`/artists/${parsed.data.artistId}`);
  return { ok: true, message: parsed.data.sceneId ? "LED configuration saved for this artist." : "LED configuration cleared for this artist." };
}
