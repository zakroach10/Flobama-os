"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorizeAudienceRun } from "@/lib/auth/permissions";
import { getStaffContext } from "@/lib/auth/staff";
import {
  AUDIENCE_SETTINGS_SQL,
  AUDIENCE_SQL_ROLE,
  AUDIENCE_SQL_TABLES,
  LED_AUDIENCE_SCENE_ID,
} from "@/lib/constants";
import {
  defaultPayloadForKind,
  isMissingAudienceRelation,
  titleForAudienceTool,
} from "@/lib/audience/engine";
import { AUDIENCE_TOOL_KINDS } from "@/lib/audience/types";
import {
  clearWallTool,
  createAudienceTool,
  endAudienceSession,
  moderateAudienceQuestion,
  putToolOnWall,
  setAudienceReveal,
  setAudienceVoting,
  startAudienceSession,
  updateToolPayload,
} from "@/lib/audience/runtime";
import { revalidatePublicSurfaces } from "@/lib/public/revalidate";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listLedWallScenes } from "@/lib/queries/led-wall";

export type AudienceActionResult = {
  ok: boolean;
  message: string;
  joinCode?: string;
  sessionId?: string;
  toolId?: string;
};

function fieldMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Check the highlighted fields.";
}

function sqlHint(message: string) {
  if (/audience_venue_settings/i.test(message)) {
    return `Apply ${AUDIENCE_SETTINGS_SQL} in the Supabase SQL editor, then try again.`;
  }
  if (isMissingAudienceRelation(message) || /interactor|staff_role/i.test(message)) {
    return `Apply ${AUDIENCE_SQL_ROLE} then ${AUDIENCE_SQL_TABLES} in the Supabase SQL editor, then try again.`;
  }
  return message;
}

async function audienceGate() {
  const context = await getStaffContext();
  if (context.status === "unconfigured") return { ok: false as const, message: "Supabase is not configured." };
  if (context.status === "unauthenticated") return { ok: false as const, message: "Sign in required." };
  if (context.status === "denied") return { ok: false as const, message: "You do not have staff access." };
  if (context.status === "error") return { ok: false as const, message: context.message };
  const allowed = authorizeAudienceRun(context.role);
  if (!allowed.allowed) return { ok: false as const, message: allowed.reason };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { ok: false as const, message: "Supabase is not configured." };
  return { ok: true as const, context, supabase };
}

function revalidateAudience() {
  revalidatePublicSurfaces();
  revalidatePath("/audience");
  revalidatePath("/screens");
  revalidatePath("/display/led");
  revalidatePath("/api/public/v1/audience/wall");
  revalidatePath("/api/public/v1/screens/led");
}

async function activateAudienceScene(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  venueId: string,
) {
  const scenes = await listLedWallScenes(supabase, venueId);
  const audienceScene =
    scenes.scenes.find((scene) => scene.enabled && scene.kind === "audience") ??
    scenes.scenes.find((scene) => scene.id === LED_AUDIENCE_SCENE_ID);
  if (!audienceScene) return;
  await supabase.from("led_wall_runtime").upsert(
    {
      venue_id: venueId,
      active_scene_id: audienceScene.id,
      active_playlist_id: null,
    },
    { onConflict: "venue_id" },
  );
}

export async function startAudienceSessionAction(input: unknown): Promise<AudienceActionResult> {
  const gate = await audienceGate();
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = z
    .object({ title: z.string().trim().min(1).max(160).optional() })
    .safeParse(input ?? {});
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  const result = await startAudienceSession(gate.supabase, {
    venueId: gate.context.venue.id,
    title: parsed.data.title ?? "Live show",
    startedBy: gate.context.userId,
  });
  if (!result.ok) return { ok: false, message: sqlHint(result.message) };

  await activateAudienceScene(gate.supabase, gate.context.venue.id);
  revalidateAudience();
  return {
    ok: true,
    message: `Audience session live — code ${result.joinCode}`,
    joinCode: result.joinCode,
    sessionId: result.sessionId,
  };
}

export async function endAudienceSessionAction(): Promise<AudienceActionResult> {
  const gate = await audienceGate();
  if (!gate.ok) return { ok: false, message: gate.message };
  const result = await endAudienceSession(gate.supabase, gate.context.venue.id);
  if (!result.ok) return { ok: false, message: sqlHint(result.message) };
  revalidateAudience();
  return { ok: true, message: "Audience session ended." };
}

export async function createAudienceToolAction(input: unknown): Promise<AudienceActionResult> {
  const gate = await audienceGate();
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = z
    .object({
      sessionId: z.string().uuid(),
      kind: z.enum(AUDIENCE_TOOL_KINDS),
      title: z.string().trim().min(1).max(200).optional(),
      payload: z.record(z.string(), z.unknown()).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  const payload = {
    ...defaultPayloadForKind(parsed.data.kind),
    ...(parsed.data.payload ?? {}),
  };
  const title = parsed.data.title ?? titleForAudienceTool(parsed.data.kind);
  const result = await createAudienceTool(gate.supabase, {
    venueId: gate.context.venue.id,
    sessionId: parsed.data.sessionId,
    kind: parsed.data.kind,
    title,
    payload,
    createdBy: gate.context.userId,
  });
  if (!result.ok) return { ok: false, message: sqlHint(result.message) };
  revalidateAudience();
  return { ok: true, message: "Tool created.", toolId: result.toolId };
}

export async function saveAudienceBrandLogoAction(input: unknown): Promise<AudienceActionResult> {
  const gate = await audienceGate();
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = z
    .object({
      storagePath: z.string().trim().min(3).max(400),
      publicUrl: z.string().url().max(800),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  const venueId = gate.context.venue.id;
  if (!parsed.data.storagePath.startsWith(`${venueId}/audience/`)) {
    return { ok: false, message: "Logo path is not valid for this venue." };
  }

  const { data: existing } = await gate.supabase
    .from("audience_venue_settings" as never)
    .select("brand_logo_path")
    .eq("venue_id", venueId)
    .maybeSingle();
  const previousPath = (existing as { brand_logo_path?: string | null } | null)?.brand_logo_path;

  const { error } = await gate.supabase.from("audience_venue_settings" as never).upsert(
    {
      venue_id: venueId,
      brand_logo_path: parsed.data.storagePath,
      brand_logo_url: parsed.data.publicUrl,
    } as never,
    { onConflict: "venue_id" },
  );
  if (error) return { ok: false, message: sqlHint(error.message) };

  if (previousPath && previousPath !== parsed.data.storagePath) {
    await gate.supabase.storage.from("screen-ads").remove([previousPath]);
  }

  revalidateAudience();
  return { ok: true, message: "Podcaster logo saved. It will show on the wall." };
}

export async function clearAudienceBrandLogoAction(): Promise<AudienceActionResult> {
  const gate = await audienceGate();
  if (!gate.ok) return { ok: false, message: gate.message };
  const venueId = gate.context.venue.id;
  const { data: existing } = await gate.supabase
    .from("audience_venue_settings" as never)
    .select("brand_logo_path")
    .eq("venue_id", venueId)
    .maybeSingle();
  const previousPath = (existing as { brand_logo_path?: string | null } | null)?.brand_logo_path;

  const { error } = await gate.supabase.from("audience_venue_settings" as never).upsert(
    {
      venue_id: venueId,
      brand_logo_path: null,
      brand_logo_url: null,
    } as never,
    { onConflict: "venue_id" },
  );
  if (error) return { ok: false, message: sqlHint(error.message) };
  if (previousPath) {
    await gate.supabase.storage.from("screen-ads").remove([previousPath]);
  }
  revalidateAudience();
  return { ok: true, message: "Podcaster logo removed." };
}

export async function putAudienceToolOnWallAction(input: unknown): Promise<AudienceActionResult> {
  const gate = await audienceGate();
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = z
    .object({
      toolId: z.string().uuid(),
      resultsRevealed: z.boolean().optional(),
      votingOpen: z.boolean().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  const result = await putToolOnWall(gate.supabase, {
    venueId: gate.context.venue.id,
    toolId: parsed.data.toolId,
    resultsRevealed: parsed.data.resultsRevealed,
    votingOpen: parsed.data.votingOpen,
  });
  if (!result.ok) return { ok: false, message: sqlHint(result.message) };
  await activateAudienceScene(gate.supabase, gate.context.venue.id);
  revalidateAudience();
  return { ok: true, message: "Tool is on the wall." };
}

export async function clearAudienceWallAction(): Promise<AudienceActionResult> {
  const gate = await audienceGate();
  if (!gate.ok) return { ok: false, message: gate.message };
  const result = await clearWallTool(gate.supabase, gate.context.venue.id);
  if (!result.ok) return { ok: false, message: sqlHint(result.message) };
  revalidateAudience();
  return { ok: true, message: "Wall cleared back to join lobby." };
}

export async function setAudienceRevealAction(input: unknown): Promise<AudienceActionResult> {
  const gate = await audienceGate();
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = z.object({ resultsRevealed: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };
  const result = await setAudienceReveal(gate.supabase, gate.context.venue.id, parsed.data.resultsRevealed);
  if (!result.ok) return { ok: false, message: sqlHint(result.message) };
  revalidateAudience();
  return {
    ok: true,
    message: parsed.data.resultsRevealed ? "Results revealed on the wall." : "Results hidden again.",
  };
}

export async function setAudienceVotingAction(input: unknown): Promise<AudienceActionResult> {
  const gate = await audienceGate();
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = z.object({ votingOpen: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };
  const result = await setAudienceVoting(gate.supabase, gate.context.venue.id, parsed.data.votingOpen);
  if (!result.ok) return { ok: false, message: sqlHint(result.message) };
  revalidateAudience();
  return { ok: true, message: parsed.data.votingOpen ? "Voting open." : "Voting closed." };
}

export async function updateAudienceToolAction(input: unknown): Promise<AudienceActionResult> {
  const gate = await audienceGate();
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = z
    .object({
      toolId: z.string().uuid(),
      title: z.string().trim().min(1).max(200).optional(),
      payload: z.record(z.string(), z.unknown()),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };
  const result = await updateToolPayload(gate.supabase, {
    venueId: gate.context.venue.id,
    toolId: parsed.data.toolId,
    title: parsed.data.title,
    payload: parsed.data.payload,
  });
  if (!result.ok) return { ok: false, message: sqlHint(result.message) };
  revalidateAudience();
  return { ok: true, message: "Tool updated." };
}

export async function moderateAudienceQuestionAction(input: unknown): Promise<AudienceActionResult> {
  const gate = await audienceGate();
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = z
    .object({
      questionId: z.string().uuid(),
      status: z.enum(["approved", "on_wall", "rejected", "done"]),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };
  const result = await moderateAudienceQuestion(gate.supabase, {
    venueId: gate.context.venue.id,
    questionId: parsed.data.questionId,
    status: parsed.data.status,
  });
  if (!result.ok) return { ok: false, message: sqlHint(result.message) };
  revalidateAudience();
  return { ok: true, message: `Question marked ${parsed.data.status.replaceAll("_", " ")}.` };
}
