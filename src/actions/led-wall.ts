"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStaffContext } from "@/lib/auth/staff";
import { authorizeLedWallActivate, authorizeLedWallConfigure } from "@/lib/auth/permissions";
import {
  LED_TRIVIA_SCENE_ID,
  LED_WALL_SQL,
  TRIVIA_DEFAULT_LOBBY_SECONDS,
  TRIVIA_DEFAULT_PACK_ID,
  TRIVIA_DEFAULT_QUESTION_COUNT,
  TRIVIA_DEFAULT_QUESTION_SECONDS,
} from "@/lib/constants";
import { createLedAgentToken, hashLedAgentToken, isMissingLedWallRelation } from "@/lib/screens/led-wall";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { endTriviaSession, startTriviaSession } from "@/lib/trivia/runtime";
import {
  activateLedWallSceneSchema,
  createLedMediaSceneSchema,
  createLedObsSceneSchema,
  ledWallMediaSceneNameSchema,
  reorderLedWallScenesSchema,
  updateLedWallSceneSchema,
} from "@/lib/validation/schemas";

export type LedWallActionResult = { ok: boolean; message: string; token?: string };

function fieldMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Check the highlighted fields.";
}

function ledSqlMessage(message: string) {
  if (isMissingLedWallRelation(message)) {
    return `Apply ${LED_WALL_SQL} in the Supabase SQL editor, then try again.`;
  }
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
  revalidatePath("/display/vertical");
  revalidatePath("/api/public/v1/screens/led");
  revalidatePath("/api/public/v1/screens/vertical");
  revalidatePath("/api/public/v1/trivia/wall");
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
    .select("id, title, enabled, kind")
    .eq("id", parsed.data.sceneId)
    .eq("venue_id", gate.context.venue.id)
    .maybeSingle();
  if (sceneError) return { ok: false, message: ledSqlMessage(sceneError.message) };
  if (!scene || !scene.enabled) return { ok: false, message: "That scene is not available." };

  if (scene.kind === "trivia") {
    const started = await startTriviaSession(gate.supabase, {
      venueId: gate.context.venue.id,
      packId: TRIVIA_DEFAULT_PACK_ID,
      questionCount: TRIVIA_DEFAULT_QUESTION_COUNT,
      lobbySeconds: TRIVIA_DEFAULT_LOBBY_SECONDS,
      questionSeconds: TRIVIA_DEFAULT_QUESTION_SECONDS,
      startedBy: gate.context.userId,
    });
    if (!started.ok && !/already running/i.test(started.message)) {
      return { ok: false, message: started.message };
    }
  } else {
    await endTriviaSession(gate.supabase, gate.context.venue.id);
  }

  let { error } = await gate.supabase.from("led_wall_runtime").upsert(
    {
      venue_id: gate.context.venue.id,
      active_scene_id: scene.id,
      active_playlist_id: null,
    },
    { onConflict: "venue_id" },
  );
  if (error && /active_playlist_id/i.test(error.message)) {
    ({ error } = await gate.supabase.from("led_wall_runtime").upsert(
      {
        venue_id: gate.context.venue.id,
        active_scene_id: scene.id,
      },
      { onConflict: "venue_id" },
    ));
  }
  if (error) return { ok: false, message: ledSqlMessage(error.message) };
  revalidateLedWall();
  if (scene.kind === "trivia") {
    return {
      ok: true,
      message: `${scene.title} is live — QR join, questions, and the timer are on the LED wall.`,
    };
  }
  if (scene.kind === "audience") {
    return {
      ok: true,
      message: `${scene.title} is ready — open Audience Interactor to start a live session and put tools on the wall.`,
    };
  }
  return { ok: true, message: `${scene.title} is the active LED wall scene.` };
}

export async function ensureLedTriviaSceneAction(): Promise<LedWallActionResult> {
  const gate = await staffGate(true);
  if (!gate.ok) return { ok: false, message: gate.message };

  const { data: existing, error: existingError } = await gate.supabase
    .from("led_wall_scenes")
    .select("id")
    .eq("venue_id", gate.context.venue.id)
    .eq("kind", "trivia")
    .limit(1)
    .maybeSingle();
  if (existingError) return { ok: false, message: ledSqlMessage(existingError.message) };
  if (existing) return { ok: true, message: "Trivia scene ready." };

  const { error } = await gate.supabase.from("led_wall_scenes").insert({
    id: LED_TRIVIA_SCENE_ID,
    venue_id: gate.context.venue.id,
    title: "Shoals Trivia",
    kind: "trivia",
    sort_order: await nextSortOrder(gate.supabase, gate.context.venue.id),
    enabled: true,
  });
  if (error) return { ok: false, message: ledSqlMessage(error.message) };
  revalidateLedWall();
  return { ok: true, message: "Shoals Trivia was added to the LED wall." };
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

export async function createLedMediaSceneAction(input: unknown): Promise<LedWallActionResult> {
  const gate = await staffGate(true);
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = createLedMediaSceneSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

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

  const { error } = await gate.supabase
    .from("led_wall_scenes")
    .update({
      title: parsed.data.title,
      enabled: parsed.data.enabled,
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
