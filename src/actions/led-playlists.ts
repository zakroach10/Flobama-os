"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStaffContext } from "@/lib/auth/staff";
import { authorizeLedWallActivate, authorizeLedWallConfigure } from "@/lib/auth/permissions";
import { LED_PLAYLIST_DEFAULT_SECONDS, LED_WALL_PLAYLISTS_SQL } from "@/lib/constants";
import { isMissingLedPlaylistRelation } from "@/lib/screens/led-playlists";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  activateLedPlaylistSchema,
  addLedPlaylistItemSchema,
  createLedPlaylistSchema,
  renameLedPlaylistSchema,
  reorderLedPlaylistItemsSchema,
  updateLedPlaylistItemSchema,
} from "@/lib/validation/schemas";

export type LedPlaylistActionResult = { ok: boolean; message: string; id?: string };

function fieldMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Check the highlighted fields.";
}

function sqlMessage(message: string) {
  if (isMissingLedPlaylistRelation(message) || /active_playlist_id/i.test(message)) {
    return `Apply ${LED_WALL_PLAYLISTS_SQL} in the Supabase SQL editor, then try again.`;
  }
  return message;
}

async function gate(configure: boolean) {
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

function revalidateLedPlaylists() {
  revalidatePath("/screens");
  revalidatePath("/display/led");
  revalidatePath("/api/public/v1/screens/led");
}

async function nextItemSortOrder(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  playlistId: string,
  venueId: string,
) {
  const { count } = await supabase
    .from("led_wall_playlist_items")
    .select("id", { count: "exact", head: true })
    .eq("playlist_id", playlistId)
    .eq("venue_id", venueId)
    .is("archived_at", null);
  return count ?? 0;
}

export async function createLedPlaylistAction(input: unknown): Promise<LedPlaylistActionResult> {
  const g = await gate(true);
  if (!g.ok) return { ok: false, message: g.message };
  const parsed = createLedPlaylistSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  const { data, error } = await g.supabase
    .from("led_wall_playlists")
    .insert({ venue_id: g.context.venue.id, name: parsed.data.name })
    .select("id")
    .single();
  if (error) return { ok: false, message: sqlMessage(error.message) };
  revalidateLedPlaylists();
  return { ok: true, id: data.id, message: "LED playlist created." };
}

export async function renameLedPlaylistAction(input: unknown): Promise<LedPlaylistActionResult> {
  const g = await gate(true);
  if (!g.ok) return { ok: false, message: g.message };
  const parsed = renameLedPlaylistSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  const { error } = await g.supabase
    .from("led_wall_playlists")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.id)
    .eq("venue_id", g.context.venue.id);
  if (error) return { ok: false, message: sqlMessage(error.message) };
  revalidateLedPlaylists();
  return { ok: true, message: "Playlist renamed." };
}

export async function archiveLedPlaylistAction(id: string): Promise<LedPlaylistActionResult> {
  const g = await gate(true);
  if (!g.ok) return { ok: false, message: g.message };

  const { data: runtime } = await g.supabase
    .from("led_wall_runtime")
    .select("active_playlist_id")
    .eq("venue_id", g.context.venue.id)
    .maybeSingle();
  if (runtime?.active_playlist_id === id) {
    return { ok: false, message: "Stop the live playlist before archiving it." };
  }

  const { error } = await g.supabase
    .from("led_wall_playlists")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("venue_id", g.context.venue.id);
  if (error) return { ok: false, message: sqlMessage(error.message) };
  revalidateLedPlaylists();
  return { ok: true, message: "Playlist archived." };
}

export async function activateLedPlaylistAction(input: unknown): Promise<LedPlaylistActionResult> {
  const g = await gate(false);
  if (!g.ok) return { ok: false, message: g.message };
  const parsed = activateLedPlaylistSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  const { data: playlist, error: playlistError } = await g.supabase
    .from("led_wall_playlists")
    .select("id, name")
    .eq("id", parsed.data.playlistId)
    .eq("venue_id", g.context.venue.id)
    .is("archived_at", null)
    .maybeSingle();
  if (playlistError) return { ok: false, message: sqlMessage(playlistError.message) };
  if (!playlist) return { ok: false, message: "That playlist is not available." };

  const { count } = await g.supabase
    .from("led_wall_playlist_items")
    .select("id", { count: "exact", head: true })
    .eq("playlist_id", playlist.id)
    .eq("enabled", true)
    .is("archived_at", null);
  if (!count) return { ok: false, message: "Add at least one scene to the playlist first." };

  const { endTriviaSession } = await import("@/lib/trivia/runtime");
  await endTriviaSession(g.supabase, g.context.venue.id);

  const { error } = await g.supabase.from("led_wall_runtime").upsert(
    {
      venue_id: g.context.venue.id,
      active_scene_id: null,
      active_playlist_id: playlist.id,
    },
    { onConflict: "venue_id" },
  );
  if (error) return { ok: false, message: sqlMessage(error.message) };
  revalidateLedPlaylists();
  return { ok: true, message: `${playlist.name} is rotating on the LED wall.` };
}

export async function addLedPlaylistItemAction(input: unknown): Promise<LedPlaylistActionResult> {
  const g = await gate(true);
  if (!g.ok) return { ok: false, message: g.message };
  const parsed = addLedPlaylistItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  const { data: scene } = await g.supabase
    .from("led_wall_scenes")
    .select("id, kind, enabled")
    .eq("id", parsed.data.sceneId)
    .eq("venue_id", g.context.venue.id)
    .maybeSingle();
  if (!scene || !scene.enabled) return { ok: false, message: "That scene is not available." };
  if (scene.kind === "trivia") {
    return { ok: false, message: "Trivia stays a one-shot activation — it cannot join a playlist." };
  }

  const sortOrder = await nextItemSortOrder(g.supabase, parsed.data.playlistId, g.context.venue.id);
  const { data, error } = await g.supabase
    .from("led_wall_playlist_items")
    .insert({
      playlist_id: parsed.data.playlistId,
      venue_id: g.context.venue.id,
      scene_id: scene.id,
      duration_seconds: parsed.data.durationSeconds ?? LED_PLAYLIST_DEFAULT_SECONDS,
      sort_order: sortOrder,
      enabled: true,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: sqlMessage(error.message) };
  revalidateLedPlaylists();
  return { ok: true, id: data.id, message: "Scene added to the LED playlist." };
}

export async function updateLedPlaylistItemAction(input: unknown): Promise<LedPlaylistActionResult> {
  const g = await gate(true);
  if (!g.ok) return { ok: false, message: g.message };
  const parsed = updateLedPlaylistItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  const { error } = await g.supabase
    .from("led_wall_playlist_items")
    .update({
      duration_seconds: parsed.data.durationSeconds,
      enabled: parsed.data.enabled,
    })
    .eq("id", parsed.data.id)
    .eq("venue_id", g.context.venue.id);
  if (error) return { ok: false, message: sqlMessage(error.message) };
  revalidateLedPlaylists();
  return { ok: true, message: "Playlist item updated." };
}

export async function reorderLedPlaylistItemsAction(input: unknown): Promise<LedPlaylistActionResult> {
  const g = await gate(true);
  if (!g.ok) return { ok: false, message: g.message };
  const parsed = reorderLedPlaylistItemsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  for (const [index, id] of parsed.data.ids.entries()) {
    const { error } = await g.supabase
      .from("led_wall_playlist_items")
      .update({ sort_order: index })
      .eq("id", id)
      .eq("playlist_id", parsed.data.playlistId)
      .eq("venue_id", g.context.venue.id);
    if (error) return { ok: false, message: sqlMessage(error.message) };
  }
  revalidateLedPlaylists();
  return { ok: true, message: "Playlist order saved." };
}

export async function archiveLedPlaylistItemAction(id: string): Promise<LedPlaylistActionResult> {
  const g = await gate(true);
  if (!g.ok) return { ok: false, message: g.message };
  const { error } = await g.supabase
    .from("led_wall_playlist_items")
    .update({ archived_at: new Date().toISOString(), enabled: false })
    .eq("id", id)
    .eq("venue_id", g.context.venue.id);
  if (error) return { ok: false, message: sqlMessage(error.message) };
  revalidateLedPlaylists();
  return { ok: true, message: "Removed from playlist." };
}
