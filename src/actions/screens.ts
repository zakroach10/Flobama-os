"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStaffContext } from "@/lib/auth/staff";
import { authorizeProgramming } from "@/lib/auth/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { WEEK_EVENTS_DEFAULT_SECONDS, WEEK_EVENTS_PUBLIC_URL } from "@/lib/constants";
import { revalidatePublicSurfaces } from "@/lib/public/revalidate";
import {
  createScreenAdRecordSchema,
  reorderScreenAdsSchema,
  screenWallStateSchema,
  updateScreenAdSchema,
} from "@/lib/validation/schemas";

export type ScreenActionResult = { ok: boolean; message: string };

function fieldMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Check the highlighted fields.";
}

async function screensGate() {
  const context = await getStaffContext();
  if (context.status === "unconfigured") return { ok: false as const, message: "Supabase is not configured." };
  if (context.status === "unauthenticated") return { ok: false as const, message: "Sign in required." };
  if (context.status === "denied") return { ok: false as const, message: "You do not have staff access." };
  if (context.status === "error") return { ok: false as const, message: context.message };
  const allowed = authorizeProgramming(context.role);
  if (!allowed.allowed) return { ok: false as const, message: allowed.reason };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { ok: false as const, message: "Supabase is not configured." };
  return { ok: true as const, context, supabase };
}

function revalidateScreens() {
  revalidatePublicSurfaces();
  revalidatePath("/screens");
  revalidatePath("/display/vertical");
  revalidatePath("/api/public/v1/screens/vertical");
}

export async function saveScreenWallAction(input: unknown): Promise<ScreenActionResult> {
  const gate = await screensGate();
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = screenWallStateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  const { error } = await gate.supabase.from("screen_wall_state").upsert({
    venue_id: gate.context.venue.id,
    mode: parsed.data.mode,
    ads_scene_name: parsed.data.adsSceneName,
    band_scene_name: parsed.data.bandSceneName,
    manual_scene_name: parsed.data.manualSceneName,
  });
  if (error) return { ok: false, message: error.message };
  revalidateScreens();
  return { ok: true, message: "LED wall settings saved." };
}

export async function createScreenAdRecordAction(input: unknown): Promise<ScreenActionResult> {
  try {
    const gate = await screensGate();
    if (!gate.ok) return { ok: false, message: gate.message };
    const parsed = createScreenAdRecordSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

    const { error } = await gate.supabase.from("screen_ads").insert({
      id: parsed.data.id,
      venue_id: gate.context.venue.id,
      title: parsed.data.title,
      storage_path: parsed.data.storagePath,
      public_url: parsed.data.publicUrl,
      media_kind: parsed.data.mediaKind,
      duration_seconds: parsed.data.durationSeconds,
      transition: parsed.data.transition,
      sort_order: parsed.data.sortOrder,
      enabled: true,
    });
    if (error) return { ok: false, message: error.message };
    revalidateScreens();
    return { ok: true, message: "Ad added to the vertical rotation." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not save the ad." };
  }
}

export async function addWeekEventsSlideAction(): Promise<ScreenActionResult> {
  const gate = await screensGate();
  if (!gate.ok) return { ok: false, message: gate.message };

  const { data: existing, error: existingError } = await gate.supabase
    .from("screen_ads")
    .select("id")
    .eq("venue_id", gate.context.venue.id)
    .eq("media_kind", "week_events")
    .is("archived_at", null)
    .limit(1);
  if (existingError) return { ok: false, message: existingError.message };
  if ((existing ?? []).length > 0) {
    return { ok: false, message: "This week's events is already in the playlist." };
  }

  const { count } = await gate.supabase
    .from("screen_ads")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", gate.context.venue.id)
    .is("archived_at", null);

  const { error } = await gate.supabase.from("screen_ads").insert({
    venue_id: gate.context.venue.id,
    title: "This week's events",
    storage_path: "",
    public_url: WEEK_EVENTS_PUBLIC_URL,
    media_kind: "week_events",
    duration_seconds: WEEK_EVENTS_DEFAULT_SECONDS,
    transition: "fade",
    sort_order: count ?? 0,
    enabled: true,
  });
  if (error) {
    return {
      ok: false,
      message: `${error.message} Apply supabase/migrations/20260908000006_week_events_slide.sql if week_events is missing.`,
    };
  }
  revalidateScreens();
  return { ok: true, message: "This week's events was added to the rotation." };
}

export async function updateScreenAdAction(input: unknown): Promise<ScreenActionResult> {
  const gate = await screensGate();
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = updateScreenAdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  const { error } = await gate.supabase
    .from("screen_ads")
    .update({
      title: parsed.data.title,
      duration_seconds: parsed.data.durationSeconds,
      transition: parsed.data.transition,
      enabled: parsed.data.enabled,
    })
    .eq("id", parsed.data.id)
    .eq("venue_id", gate.context.venue.id);
  if (error) return { ok: false, message: error.message };
  revalidateScreens();
  return { ok: true, message: "Ad updated." };
}

export async function reorderScreenAdsAction(input: unknown): Promise<ScreenActionResult> {
  const gate = await screensGate();
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = reorderScreenAdsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  for (const [index, id] of parsed.data.ids.entries()) {
    const { error } = await gate.supabase
      .from("screen_ads")
      .update({ sort_order: index })
      .eq("id", id)
      .eq("venue_id", gate.context.venue.id);
    if (error) return { ok: false, message: error.message };
  }
  revalidateScreens();
  return { ok: true, message: "Playlist order saved." };
}

export async function archiveScreenAdAction(id: string): Promise<ScreenActionResult> {
  const gate = await screensGate();
  if (!gate.ok) return { ok: false, message: gate.message };
  const { error } = await gate.supabase
    .from("screen_ads")
    .update({ archived_at: new Date().toISOString(), enabled: false })
    .eq("id", id)
    .eq("venue_id", gate.context.venue.id);
  if (error) return { ok: false, message: error.message };
  revalidateScreens();
  return { ok: true, message: "Ad removed from the rotation." };
}

