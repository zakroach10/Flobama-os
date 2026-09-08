"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStaffContext } from "@/lib/auth/staff";
import { authorizeProgramming } from "@/lib/auth/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { WEEK_EVENTS_DEFAULT_SECONDS, WEEK_EVENTS_PUBLIC_URL } from "@/lib/constants";
import { getPublicSupabaseEnv } from "@/lib/env";
import { revalidatePublicSurfaces } from "@/lib/public/revalidate";
import {
  reorderScreenAdsSchema,
  screenAdMetaSchema,
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

export async function uploadScreenAdAction(formData: FormData): Promise<ScreenActionResult> {
  const gate = await screensGate();
  if (!gate.ok) return { ok: false, message: gate.message };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose an image or video file." };
  }
  if (file.size > 50 * 1024 * 1024) {
    return { ok: false, message: "File must be 50 MB or smaller." };
  }

  const title = String(formData.get("title") ?? "").trim() || file.name.replace(/\.[^.]+$/, "");
  const transition = formData.get("transition");
  const durationRaw = String(formData.get("durationSeconds") ?? "").trim();
  const mediaKind = file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "image" : null;
  if (!mediaKind) return { ok: false, message: "Use an image (JPEG, PNG, WebP, GIF) or a video (MP4, WebM)." };

  const durationSeconds = durationRaw ? Number(durationRaw) : mediaKind === "image" ? 10 : null;
  const parsed = screenAdMetaSchema.safeParse({
    title,
    durationSeconds,
    transition: transition || "fade",
    enabled: true,
    mediaKind,
  });
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  const env = getPublicSupabaseEnv();
  if (!env) return { ok: false, message: "Supabase is not configured." };

  const { count } = await gate.supabase
    .from("screen_ads")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", gate.context.venue.id)
    .is("archived_at", null);

  const id = randomUUID();
  const ext = extensionFor(file) ?? (mediaKind === "video" ? "mp4" : "jpg");
  const storagePath = `${gate.context.venue.id}/${id}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await gate.supabase.storage.from("screen-ads").upload(storagePath, buffer, {
    contentType: file.type || (mediaKind === "video" ? "video/mp4" : "image/jpeg"),
    upsert: false,
  });
  if (uploadError) return { ok: false, message: uploadError.message };

  const publicUrl = `${env.url.replace(/\/$/, "")}/storage/v1/object/public/screen-ads/${storagePath}`;
  const { error: insertError } = await gate.supabase.from("screen_ads").insert({
    id,
    venue_id: gate.context.venue.id,
    title: parsed.data.title,
    storage_path: storagePath,
    public_url: publicUrl,
    media_kind: mediaKind,
    duration_seconds: parsed.data.durationSeconds,
    transition: parsed.data.transition,
    sort_order: count ?? 0,
    enabled: true,
  });
  if (insertError) {
    await gate.supabase.storage.from("screen-ads").remove([storagePath]);
    return { ok: false, message: insertError.message };
  }

  revalidateScreens();
  return { ok: true, message: "Ad added to the vertical rotation." };
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

function extensionFor(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{1,5}$/.test(fromName)) return fromName;
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  if (file.type === "video/mp4") return "mp4";
  if (file.type === "video/webm") return "webm";
  return null;
}
