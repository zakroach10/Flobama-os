"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorizeLedWallActivate, authorizeProgramming } from "@/lib/auth/permissions";
import { getStaffContext } from "@/lib/auth/staff";
import { ARTIST_LED_MULTI_VISUALIZER_SQL, ARTIST_LED_WALL_SQL, LED_WALL_SQL } from "@/lib/constants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { upsertArtistLedMedia } from "@/lib/events/artwork";
import { pickDefaultArtistScene } from "@/lib/screens/artist-led";
import { endTriviaSession } from "@/lib/trivia/runtime";

export type ArtistLedActionResult = { ok: boolean; message: string; sceneId?: string };

function fieldMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Check the highlighted fields.";
}

function sqlHint(message: string) {
  if (/is_default/i.test(message) && /does not exist|schema cache|could not find/i.test(message)) {
    return `Apply ${ARTIST_LED_MULTI_VISUALIZER_SQL} in the Supabase SQL editor, then try again.`;
  }
  if (/artist_id|default_playlist_id|activation_source/i.test(message)) {
    return `Apply ${ARTIST_LED_WALL_SQL} in the Supabase SQL editor, then try again.`;
  }
  if (/led_wall_/i.test(message) && /does not exist|schema cache/i.test(message)) {
    return `Apply ${LED_WALL_SQL} in the Supabase SQL editor, then try again.`;
  }
  return message;
}

async function gate(kind: "program" | "activate") {
  const context = await getStaffContext();
  if (context.status === "unconfigured") return { ok: false as const, message: "Supabase is not configured." };
  if (context.status === "unauthenticated") return { ok: false as const, message: "Sign in required." };
  if (context.status === "denied") return { ok: false as const, message: "You do not have staff access." };
  if (context.status === "error") return { ok: false as const, message: context.message };
  const allowed =
    kind === "program" ? authorizeProgramming(context.role) : authorizeLedWallActivate(context.role);
  if (!allowed.allowed) return { ok: false as const, message: allowed.reason };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { ok: false as const, message: "Supabase is not configured." };
  return { ok: true as const, context, supabase };
}

function revalidateArtistLed(artistId?: string) {
  revalidatePath("/screens");
  revalidatePath("/artists");
  if (artistId) revalidatePath(`/artists/${artistId}`);
  revalidatePath("/display/led");
  revalidatePath("/api/public/v1/screens/led");
}

const saveArtistLedMediaSchema = z.object({
  artistId: z.string().uuid(),
  sceneId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(160).optional(),
  mediaKind: z.enum(["image", "video"]),
  storagePath: z.string().trim().min(1).max(500),
  publicUrl: z.string().trim().min(8).max(800),
});

export async function saveArtistLedMediaAction(input: unknown): Promise<ArtistLedActionResult> {
  const g = await gate("program");
  if (!g.ok) return { ok: false, message: g.message };
  const parsed = saveArtistLedMediaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  const { data: artist, error: artistError } = await g.supabase
    .from("artists")
    .select("id, name, archived_at")
    .eq("id", parsed.data.artistId)
    .eq("venue_id", g.context.venue.id)
    .maybeSingle();
  if (artistError) return { ok: false, message: artistError.message };
  if (!artist || artist.archived_at) return { ok: false, message: "Artist not found." };

  const title = parsed.data.title?.trim() || artist.name;
  const saved = await upsertArtistLedMedia(g.supabase, {
    venueId: g.context.venue.id,
    artistId: artist.id,
    title,
    mediaKind: parsed.data.mediaKind,
    storagePath: parsed.data.storagePath,
    publicUrl: parsed.data.publicUrl,
    sceneId: parsed.data.sceneId,
  });
  if (!saved.ok) return { ok: false, message: sqlHint(saved.message) };
  revalidateArtistLed(artist.id);
  return {
    ok: true,
    message: parsed.data.sceneId ? "Artist LED graphic updated." : "Artist LED graphic added.",
    sceneId: saved.sceneId,
  };
}

export async function setArtistLedEnabledAction(input: unknown): Promise<ArtistLedActionResult> {
  const g = await gate("program");
  if (!g.ok) return { ok: false, message: g.message };
  const parsed = z
    .object({
      artistId: z.string().uuid(),
      sceneId: z.string().uuid().optional(),
      enabled: z.boolean(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  let query = g.supabase
    .from("led_wall_scenes")
    .update({ enabled: parsed.data.enabled })
    .eq("venue_id", g.context.venue.id)
    .eq("artist_id", parsed.data.artistId);
  if (parsed.data.sceneId) query = query.eq("id", parsed.data.sceneId);
  const { error } = await query;
  if (error) return { ok: false, message: sqlHint(error.message) };
  revalidateArtistLed(parsed.data.artistId);
  return {
    ok: true,
    message: parsed.data.enabled ? "Artist LED graphic enabled." : "Artist LED graphic disabled.",
  };
}

export async function setArtistLedDefaultAction(input: unknown): Promise<ArtistLedActionResult> {
  const g = await gate("program");
  if (!g.ok) return { ok: false, message: g.message };
  const parsed = z
    .object({ artistId: z.string().uuid(), sceneId: z.string().uuid() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  const venueId = g.context.venue.id;
  const { data: scene, error: sceneError } = await g.supabase
    .from("led_wall_scenes")
    .select("id")
    .eq("id", parsed.data.sceneId)
    .eq("venue_id", venueId)
    .eq("artist_id", parsed.data.artistId)
    .maybeSingle();
  if (sceneError) return { ok: false, message: sqlHint(sceneError.message) };
  if (!scene) return { ok: false, message: "Visualizer not found." };

  const { error: clearError } = await g.supabase
    .from("led_wall_scenes")
    .update({ is_default: false } as never)
    .eq("venue_id", venueId)
    .eq("artist_id", parsed.data.artistId)
    .neq("id", parsed.data.sceneId);
  if (clearError) return { ok: false, message: sqlHint(clearError.message) };

  const { error } = await g.supabase
    .from("led_wall_scenes")
    .update({ is_default: true, enabled: true } as never)
    .eq("id", parsed.data.sceneId)
    .eq("venue_id", venueId);
  if (error) return { ok: false, message: sqlHint(error.message) };

  revalidateArtistLed(parsed.data.artistId);
  return { ok: true, message: "Default LED visualizer updated.", sceneId: parsed.data.sceneId };
}

export async function clearArtistLedMediaAction(input: unknown): Promise<ArtistLedActionResult> {
  const g = await gate("program");
  if (!g.ok) return { ok: false, message: g.message };

  // Backward compatible: string artistId clears all; object can target one scene.
  if (typeof input === "string") {
    if (!z.string().uuid().safeParse(input).success) return { ok: false, message: "Invalid artist." };
    const { error } = await g.supabase
      .from("led_wall_scenes")
      .delete()
      .eq("venue_id", g.context.venue.id)
      .eq("artist_id", input);
    if (error) return { ok: false, message: sqlHint(error.message) };
    revalidateArtistLed(input);
    return { ok: true, message: "Artist LED graphics removed." };
  }

  const parsed = z
    .object({
      artistId: z.string().uuid(),
      sceneId: z.string().uuid().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  let query = g.supabase
    .from("led_wall_scenes")
    .delete()
    .eq("venue_id", g.context.venue.id)
    .eq("artist_id", parsed.data.artistId);
  if (parsed.data.sceneId) query = query.eq("id", parsed.data.sceneId);
  const { error } = await query;
  if (error) return { ok: false, message: sqlHint(error.message) };

  if (parsed.data.sceneId) {
    const { data: remaining } = await g.supabase
      .from("led_wall_scenes")
      .select("id, is_default, enabled")
      .eq("venue_id", g.context.venue.id)
      .eq("artist_id", parsed.data.artistId);
    const rows = (remaining ?? []) as Array<{ id: string; is_default: boolean | null; enabled: boolean }>;
    if (rows.length > 0 && !rows.some((row) => row.is_default)) {
      const nextDefault = pickDefaultArtistScene(
        rows.map((row) => ({ id: row.id, enabled: row.enabled, is_default: false })),
      );
      if (nextDefault) {
        await g.supabase
          .from("led_wall_scenes")
          .update({ is_default: true } as never)
          .eq("id", nextDefault.id)
          .eq("venue_id", g.context.venue.id);
      }
    }
  }

  revalidateArtistLed(parsed.data.artistId);
  return {
    ok: true,
    message: parsed.data.sceneId ? "Visualizer removed." : "Artist LED graphics removed.",
  };
}

export async function activateArtistLedAction(input: unknown): Promise<ArtistLedActionResult> {
  const g = await gate("activate");
  if (!g.ok) return { ok: false, message: g.message };
  const parsed = z
    .object({
      artistId: z.string().uuid(),
      sceneId: z.string().uuid().optional(),
      eventId: z.string().uuid().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  let scene: { id: string; title: string; enabled: boolean } | null = null;

  if (parsed.data.sceneId) {
    const { data, error } = await g.supabase
      .from("led_wall_scenes")
      .select("id, title, enabled")
      .eq("venue_id", g.context.venue.id)
      .eq("artist_id", parsed.data.artistId)
      .eq("id", parsed.data.sceneId)
      .maybeSingle();
    if (error) return { ok: false, message: sqlHint(error.message) };
    scene = data;
  } else {
    const { data, error } = await g.supabase
      .from("led_wall_scenes")
      .select("id, title, enabled, is_default, sort_order")
      .eq("venue_id", g.context.venue.id)
      .eq("artist_id", parsed.data.artistId);
    if (error && /is_default/i.test(error.message)) {
      const legacy = await g.supabase
        .from("led_wall_scenes")
        .select("id, title, enabled")
        .eq("venue_id", g.context.venue.id)
        .eq("artist_id", parsed.data.artistId)
        .maybeSingle();
      if (legacy.error) return { ok: false, message: sqlHint(legacy.error.message) };
      scene = legacy.data;
    } else if (error) {
      return { ok: false, message: sqlHint(error.message) };
    } else {
      const picked = pickDefaultArtistScene(
        ((data ?? []) as Array<{
          id: string;
          title: string;
          enabled: boolean;
          is_default?: boolean | null;
          sort_order?: number | null;
        }>).map((row) => ({
          id: row.id,
          title: row.title,
          enabled: row.enabled,
          is_default: row.is_default,
          sort_order: row.sort_order,
        })),
      );
      scene = picked ? { id: picked.id, title: picked.title, enabled: picked.enabled } : null;
    }
  }

  if (!scene || !scene.enabled) {
    return { ok: false, message: "That artist does not have an active LED graphic yet." };
  }

  await endTriviaSession(g.supabase, g.context.venue.id);
  const { error } = await g.supabase.from("led_wall_runtime").upsert(
    {
      venue_id: g.context.venue.id,
      active_scene_id: scene.id,
      active_playlist_id: null,
      activation_source: "manual",
      auto_event_id: parsed.data.eventId ?? null,
      auto_artist_id: parsed.data.artistId,
    },
    { onConflict: "venue_id" },
  );
  if (error) return { ok: false, message: sqlHint(error.message) };
  revalidateArtistLed(parsed.data.artistId);
  return { ok: true, message: `${scene.title} is on the LED wall.`, sceneId: scene.id };
}

export async function setDefaultAdRollPlaylistAction(input: unknown): Promise<ArtistLedActionResult> {
  const context = await getStaffContext();
  if (context.status !== "ok") return { ok: false, message: "Sign in required." };
  const { authorizeLedWallConfigure } = await import("@/lib/auth/permissions");
  const allowed = authorizeLedWallConfigure(context.role);
  if (!allowed.allowed) return { ok: false, message: allowed.reason };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { ok: false, message: "Supabase is not configured." };

  const parsed = z
    .object({ playlistId: z.string().uuid().nullable() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  if (parsed.data.playlistId) {
    const { data: playlist } = await supabase
      .from("led_wall_playlists")
      .select("id")
      .eq("id", parsed.data.playlistId)
      .eq("venue_id", context.venue.id)
      .is("archived_at", null)
      .maybeSingle();
    if (!playlist) return { ok: false, message: "That playlist is not available." };
  }

  const { error } = await supabase.from("led_wall_settings").upsert(
    {
      venue_id: context.venue.id,
      default_playlist_id: parsed.data.playlistId,
    },
    { onConflict: "venue_id" },
  );
  if (error) return { ok: false, message: sqlHint(error.message) };
  revalidateArtistLed();
  return {
    ok: true,
    message: parsed.data.playlistId
      ? "Ad roll set as the default LED program."
      : "Default ad roll cleared.",
  };
}

export async function activateDefaultAdRollAction(): Promise<ArtistLedActionResult> {
  const g = await gate("activate");
  if (!g.ok) return { ok: false, message: g.message };

  const { data: settings, error: settingsError } = await g.supabase
    .from("led_wall_settings")
    .select("default_playlist_id")
    .eq("venue_id", g.context.venue.id)
    .maybeSingle();
  if (settingsError) return { ok: false, message: sqlHint(settingsError.message) };
  if (!settings?.default_playlist_id) {
    return { ok: false, message: "Set a default ad-roll playlist first (admin)." };
  }

  const { data: playlist } = await g.supabase
    .from("led_wall_playlists")
    .select("id, name")
    .eq("id", settings.default_playlist_id)
    .eq("venue_id", g.context.venue.id)
    .is("archived_at", null)
    .maybeSingle();
  if (!playlist) return { ok: false, message: "Default ad-roll playlist is missing." };

  const { count } = await g.supabase
    .from("led_wall_playlist_items")
    .select("id", { count: "exact", head: true })
    .eq("playlist_id", playlist.id)
    .eq("venue_id", g.context.venue.id)
    .eq("enabled", true)
    .is("archived_at", null);
  if (!count) return { ok: false, message: "Add scenes to the ad-roll playlist first." };

  await endTriviaSession(g.supabase, g.context.venue.id);
  const { error } = await g.supabase.from("led_wall_runtime").upsert(
    {
      venue_id: g.context.venue.id,
      active_scene_id: null,
      active_playlist_id: playlist.id,
      activation_source: "ad_roll",
      auto_event_id: null,
      auto_artist_id: null,
    },
    { onConflict: "venue_id" },
  );
  if (error) return { ok: false, message: sqlHint(error.message) };
  revalidateArtistLed();
  return { ok: true, message: `${playlist.name} (ad roll) is live on the LED wall.` };
}
