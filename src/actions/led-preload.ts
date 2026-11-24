"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStaffContext } from "@/lib/auth/staff";
import { authorizeLedWallActivate } from "@/lib/auth/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { PreloadReportState } from "@/lib/screens/led-preload";
import { isMissingPreloadRelation, listPreloadReports, preloadReportSummary } from "@/lib/screens/led-preload-data";

const pinSchema = z.object({
  sceneId: z.string().uuid(),
});

export type PreloadPinResult = { ok: boolean; message: string };

async function gate() {
  const context = await getStaffContext();
  if (context.status !== "ok") return { ok: false as const, message: "Sign in required." };
  const allowed = authorizeLedWallActivate(context.role);
  if (!allowed.allowed) return { ok: false as const, message: allowed.reason };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { ok: false as const, message: "Supabase is not configured." };
  return { ok: true as const, context, supabase };
}

function missingMessage() {
  return "Apply supabase/migrations/20261107000066_led_wall_preload.sql, then try again.";
}

export async function pinLedPreloadAction(input: unknown): Promise<PreloadPinResult> {
  const gateResult = await gate();
  if (!gateResult.ok) return gateResult;
  const parsed = pinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Choose a visual to preload." };

  const { data: scene, error: sceneError } = await gateResult.supabase
    .from("led_wall_scenes")
    .select("id, kind, media_kind, public_url, enabled")
    .eq("id", parsed.data.sceneId)
    .eq("venue_id", gateResult.context.venue.id)
    .maybeSingle();
  if (sceneError) return { ok: false, message: sceneError.message };
  if (!scene || !scene.enabled) return { ok: false, message: "That visual is not available." };
  if (scene.kind !== "media" || (scene.media_kind !== "image" && scene.media_kind !== "video")) {
    return { ok: false, message: "Only image and video visuals can be preloaded." };
  }
  if (!scene.public_url) return { ok: false, message: "That visual has no file yet." };

  const { error } = await gateResult.supabase.from("led_wall_preload_pins" as never).upsert(
    {
      venue_id: gateResult.context.venue.id,
      scene_id: scene.id,
      created_by: gateResult.context.userId,
    } as never,
    { onConflict: "venue_id,scene_id", ignoreDuplicates: true },
  );
  if (error) {
    if (isMissingPreloadRelation(error.message)) return { ok: false, message: missingMessage() };
    return { ok: false, message: error.message };
  }
  revalidatePath("/screens");
  revalidatePath("/api/public/v1/screens/led");
  return { ok: true, message: "The Local Runner will download this without changing what is live." };
}

export async function unpinLedPreloadAction(input: unknown): Promise<PreloadPinResult> {
  const gateResult = await gate();
  if (!gateResult.ok) return gateResult;
  const parsed = pinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Choose a visual to release." };
  const { error } = await gateResult.supabase
    .from("led_wall_preload_pins" as never)
    .delete()
    .eq("venue_id", gateResult.context.venue.id)
    .eq("scene_id", parsed.data.sceneId);
  if (error) {
    if (isMissingPreloadRelation(error.message)) return { ok: false, message: missingMessage() };
    return { ok: false, message: error.message };
  }
  revalidatePath("/screens");
  revalidatePath("/api/public/v1/screens/led");
  return { ok: true, message: "Stopped asking the wall to keep that visual warm." };
}

export async function readLedPreloadStatusAction(): Promise<{
  ok: boolean;
  reports: Record<string, { state: PreloadReportState; message: string | null }>;
  missingTable: boolean;
}> {
  const gateResult = await gate();
  if (!gateResult.ok) return { ok: false, reports: {}, missingTable: false };
  const listed = await listPreloadReports(gateResult.supabase, gateResult.context.venue.id);
  return {
    ok: true,
    missingTable: listed.missingTable,
    reports: preloadReportSummary(listed.reports),
  };
}
