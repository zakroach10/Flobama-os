"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorizeTriviaConfigure, authorizeTriviaRun } from "@/lib/auth/permissions";
import { getStaffContext } from "@/lib/auth/staff";
import { revalidatePublicSurfaces } from "@/lib/public/revalidate";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { parseTriviaCsv } from "@/lib/trivia/csv";
import { isMissingTriviaRelation, normalizeDisplayName } from "@/lib/trivia/engine";
import { endTriviaSession, startTriviaSession } from "@/lib/trivia/runtime";
import { importTriviaCsvSchema, startTriviaSchema } from "@/lib/validation/schemas";
import { listLedWallScenes } from "@/lib/queries/led-wall";

export type TriviaActionResult = { ok: boolean; message: string; joinCode?: string; sessionId?: string };

function fieldMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Check the highlighted fields.";
}

async function triviaGate(mode: "run" | "configure") {
  const context = await getStaffContext();
  if (context.status === "unconfigured") return { ok: false as const, message: "Supabase is not configured." };
  if (context.status === "unauthenticated") return { ok: false as const, message: "Sign in required." };
  if (context.status === "denied") return { ok: false as const, message: "You do not have staff access." };
  if (context.status === "error") return { ok: false as const, message: context.message };
  const allowed = mode === "configure" ? authorizeTriviaConfigure(context.role) : authorizeTriviaRun(context.role);
  if (!allowed.allowed) return { ok: false as const, message: allowed.reason };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { ok: false as const, message: "Supabase is not configured." };
  return { ok: true as const, context, supabase };
}

function revalidateTrivia() {
  revalidatePublicSurfaces();
  revalidatePath("/screens");
  revalidatePath("/display/led");
  revalidatePath("/display/vertical");
  revalidatePath("/api/public/v1/trivia/wall");
  revalidatePath("/api/public/v1/screens/led");
  revalidatePath("/api/public/v1/screens/vertical");
}

export async function startTriviaAction(input: unknown): Promise<TriviaActionResult> {
  const gate = await triviaGate("run");
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = startTriviaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  const result = await startTriviaSession(gate.supabase, {
    venueId: gate.context.venue.id,
    packId: parsed.data.packId,
    questionCount: parsed.data.questionCount,
    lobbySeconds: parsed.data.lobbySeconds,
    questionSeconds: parsed.data.questionSeconds,
    startedBy: gate.context.userId,
  });

  if (!result.ok) {
    if (isMissingTriviaRelation(result.message)) {
      return { ok: false, message: "Apply the trivia SQL migration, then try again." };
    }
    return { ok: false, message: result.message };
  }

  const scenes = await listLedWallScenes(gate.supabase, gate.context.venue.id);
  const triviaScene = scenes.scenes.find((scene) => scene.enabled && scene.kind === "trivia");
  if (triviaScene) {
    await gate.supabase.from("led_wall_runtime").upsert(
      {
        venue_id: gate.context.venue.id,
        active_scene_id: triviaScene.id,
      },
      { onConflict: "venue_id" },
    );
  }

  revalidateTrivia();
  return {
    ok: true,
    message: result.message,
    joinCode: result.joinCode,
    sessionId: result.sessionId,
  };
}

export async function endTriviaAction(): Promise<TriviaActionResult> {
  const gate = await triviaGate("run");
  if (!gate.ok) return { ok: false, message: gate.message };
  const result = await endTriviaSession(gate.supabase, gate.context.venue.id);
  if (!result.ok) {
    if (isMissingTriviaRelation(result.message)) {
      return { ok: false, message: "Apply the trivia SQL migration, then try again." };
    }
    return { ok: false, message: result.message };
  }
  revalidateTrivia();
  return result;
}

export async function importTriviaCsvAction(input: unknown): Promise<TriviaActionResult> {
  const gate = await triviaGate("configure");
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = importTriviaCsvSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  const { questions, errors } = parseTriviaCsv(parsed.data.csvText);
  if (errors.length > 0) return { ok: false, message: errors[0]! };
  if (questions.length === 0) return { ok: false, message: "No questions found in the spreadsheet." };

  const { data: pack, error: packError } = await gate.supabase
    .from("trivia_packs" as never)
    .select("id")
    .eq("id", parsed.data.packId)
    .eq("venue_id", gate.context.venue.id)
    .maybeSingle();
  if (packError) {
    if (isMissingTriviaRelation(packError.message)) {
      return { ok: false, message: "Apply the trivia SQL migration, then try again." };
    }
    return { ok: false, message: packError.message };
  }
  if (!pack) return { ok: false, message: "Pack not found." };

  if (parsed.data.replace) {
    const { error: deleteError } = await gate.supabase
      .from("trivia_questions" as never)
      .delete()
      .eq("pack_id", parsed.data.packId)
      .eq("venue_id", gate.context.venue.id);
    if (deleteError) return { ok: false, message: deleteError.message };
  }

  const rows = questions.map((question, index) => ({
    pack_id: parsed.data.packId,
    venue_id: gate.context.venue.id,
    prompt: question.prompt,
    choice_a: question.choiceA,
    choice_b: question.choiceB,
    choice_c: question.choiceC,
    choice_d: question.choiceD,
    correct_index: question.correctIndex,
    points: question.points,
    sort_order: index,
  }));

  const { error: insertError } = await gate.supabase.from("trivia_questions" as never).insert(rows as never);
  if (insertError) return { ok: false, message: insertError.message };

  revalidateTrivia();
  return {
    ok: true,
    message: `Imported ${questions.length} question${questions.length === 1 ? "" : "s"}.`,
  };
}

export async function ensureTriviaDisplayName(raw: string) {
  return normalizeDisplayName(raw);
}
