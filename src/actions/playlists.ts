"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStaffContext } from "@/lib/auth/staff";
import { authorizeProgramming } from "@/lib/auth/permissions";
import { SCREEN_PLAYLISTS_SQL, WEEK_EVENTS_DEFAULT_SECONDS } from "@/lib/constants";
import { revalidatePublicSurfaces } from "@/lib/public/revalidate";
import { isMissingScreenPlaylistRelation } from "@/lib/screens/playlists";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  activateScreenPlaylistSchema,
  addPlaylistMediaItemSchema,
  addPlaylistSpecialItemSchema,
  addPlaylistWeekEventsSchema,
  createMenuSpecialRecordSchema,
  createScreenPlaylistSchema,
  renameScreenPlaylistSchema,
  reorderPlaylistItemsSchema,
  updateMenuSpecialSchema,
  updatePlaylistItemSchema,
} from "@/lib/validation/schemas";

export type PlaylistActionResult = { ok: boolean; message: string; id?: string };

function fieldMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Check the highlighted fields.";
}

function playlistSqlMessage(message: string) {
  if (isMissingScreenPlaylistRelation(message)) {
    return `Apply ${SCREEN_PLAYLISTS_SQL} in the Supabase SQL editor, then try again.`;
  }
  return message;
}

async function playlistsGate() {
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

function revalidatePlaylists() {
  revalidatePublicSurfaces();
  revalidatePath("/screens");
  revalidatePath("/display/vertical");
  revalidatePath("/api/public/v1/screens/vertical");
}

async function nextItemSortOrder(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  playlistId: string,
  venueId: string,
) {
  if (!supabase) return 0;
  const { count } = await supabase
    .from("screen_playlist_items")
    .select("id", { count: "exact", head: true })
    .eq("playlist_id", playlistId)
    .eq("venue_id", venueId)
    .is("archived_at", null);
  return count ?? 0;
}

export async function createScreenPlaylistAction(input: unknown): Promise<PlaylistActionResult> {
  const gate = await playlistsGate();
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = createScreenPlaylistSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  if (parsed.data.activate) {
    await gate.supabase
      .from("screen_playlists")
      .update({ is_active: false })
      .eq("venue_id", gate.context.venue.id)
      .is("archived_at", null);
  }

  const { data, error } = await gate.supabase
    .from("screen_playlists")
    .insert({
      venue_id: gate.context.venue.id,
      name: parsed.data.name,
      is_active: parsed.data.activate,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: playlistSqlMessage(error.message) };
  revalidatePlaylists();
  return { ok: true, id: data.id, message: parsed.data.activate ? "Playlist created and set live." : "Playlist created." };
}

export async function renameScreenPlaylistAction(input: unknown): Promise<PlaylistActionResult> {
  const gate = await playlistsGate();
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = renameScreenPlaylistSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  const { error } = await gate.supabase
    .from("screen_playlists")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.id)
    .eq("venue_id", gate.context.venue.id);
  if (error) return { ok: false, message: playlistSqlMessage(error.message) };
  revalidatePlaylists();
  return { ok: true, message: "Playlist renamed." };
}

export async function activateScreenPlaylistAction(input: unknown): Promise<PlaylistActionResult> {
  const gate = await playlistsGate();
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = activateScreenPlaylistSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  const { error: clearError } = await gate.supabase
    .from("screen_playlists")
    .update({ is_active: false })
    .eq("venue_id", gate.context.venue.id)
    .is("archived_at", null);
  if (clearError) return { ok: false, message: playlistSqlMessage(clearError.message) };

  const { error } = await gate.supabase
    .from("screen_playlists")
    .update({ is_active: true })
    .eq("id", parsed.data.id)
    .eq("venue_id", gate.context.venue.id);
  if (error) return { ok: false, message: playlistSqlMessage(error.message) };
  revalidatePlaylists();
  return { ok: true, message: "Playlist is now live on vertical screens." };
}

export async function archiveScreenPlaylistAction(id: string): Promise<PlaylistActionResult> {
  const gate = await playlistsGate();
  if (!gate.ok) return { ok: false, message: gate.message };

  const { data: playlist } = await gate.supabase
    .from("screen_playlists")
    .select("is_active")
    .eq("id", id)
    .eq("venue_id", gate.context.venue.id)
    .maybeSingle();
  if (playlist?.is_active) {
    return { ok: false, message: "Activate another playlist before archiving the live one." };
  }

  const { error } = await gate.supabase
    .from("screen_playlists")
    .update({ archived_at: new Date().toISOString(), is_active: false })
    .eq("id", id)
    .eq("venue_id", gate.context.venue.id);
  if (error) return { ok: false, message: playlistSqlMessage(error.message) };
  revalidatePlaylists();
  return { ok: true, message: "Playlist archived." };
}

export async function addPlaylistMediaItemAction(input: unknown): Promise<PlaylistActionResult> {
  const gate = await playlistsGate();
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = addPlaylistMediaItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  const { data: media } = await gate.supabase
    .from("screen_ads")
    .select("id, duration_seconds, transition, media_kind, public_url")
    .eq("id", parsed.data.mediaId)
    .eq("venue_id", gate.context.venue.id)
    .is("archived_at", null)
    .maybeSingle();
  if (!media) return { ok: false, message: "Media not found." };

  const week = media.media_kind === "week_events" || media.public_url.startsWith("dynamic://week_events");
  const sortOrder = await nextItemSortOrder(gate.supabase, parsed.data.playlistId, gate.context.venue.id);
  const { data, error } = await gate.supabase
    .from("screen_playlist_items")
    .insert({
      playlist_id: parsed.data.playlistId,
      venue_id: gate.context.venue.id,
      source_kind: week ? "week_events" : "media",
      media_id: week ? null : media.id,
      duration_seconds: media.duration_seconds,
      transition: media.transition,
      sort_order: sortOrder,
      enabled: true,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: playlistSqlMessage(error.message) };
  revalidatePlaylists();
  return { ok: true, id: data.id, message: "Added to playlist." };
}

export async function addPlaylistSpecialItemAction(input: unknown): Promise<PlaylistActionResult> {
  const gate = await playlistsGate();
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = addPlaylistSpecialItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  const { data: special } = await gate.supabase
    .from("menu_specials")
    .select("id, duration_seconds")
    .eq("id", parsed.data.specialId)
    .eq("venue_id", gate.context.venue.id)
    .is("archived_at", null)
    .maybeSingle();
  if (!special) return { ok: false, message: "Special not found." };

  const sortOrder = await nextItemSortOrder(gate.supabase, parsed.data.playlistId, gate.context.venue.id);
  const { data, error } = await gate.supabase
    .from("screen_playlist_items")
    .insert({
      playlist_id: parsed.data.playlistId,
      venue_id: gate.context.venue.id,
      source_kind: "special",
      special_id: special.id,
      duration_seconds: special.duration_seconds,
      transition: "fade",
      sort_order: sortOrder,
      enabled: true,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: playlistSqlMessage(error.message) };
  revalidatePlaylists();
  return { ok: true, id: data.id, message: "Special added to playlist." };
}

export async function addPlaylistWeekEventsAction(input: unknown): Promise<PlaylistActionResult> {
  const gate = await playlistsGate();
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = addPlaylistWeekEventsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  const { data: existing } = await gate.supabase
    .from("screen_playlist_items")
    .select("id")
    .eq("playlist_id", parsed.data.playlistId)
    .eq("source_kind", "week_events")
    .is("archived_at", null)
    .limit(1);
  if ((existing ?? []).length > 0) {
    return { ok: false, message: "This week's events is already in this playlist." };
  }

  const sortOrder = await nextItemSortOrder(gate.supabase, parsed.data.playlistId, gate.context.venue.id);
  const { data, error } = await gate.supabase
    .from("screen_playlist_items")
    .insert({
      playlist_id: parsed.data.playlistId,
      venue_id: gate.context.venue.id,
      source_kind: "week_events",
      duration_seconds: WEEK_EVENTS_DEFAULT_SECONDS,
      transition: "fade",
      sort_order: sortOrder,
      enabled: true,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: playlistSqlMessage(error.message) };
  revalidatePlaylists();
  return { ok: true, id: data.id, message: "This week's events was added to the playlist." };
}

export async function updatePlaylistItemAction(input: unknown): Promise<PlaylistActionResult> {
  const gate = await playlistsGate();
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = updatePlaylistItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  const { error } = await gate.supabase
    .from("screen_playlist_items")
    .update({
      duration_seconds: parsed.data.durationSeconds,
      transition: parsed.data.transition,
      enabled: parsed.data.enabled,
    })
    .eq("id", parsed.data.id)
    .eq("venue_id", gate.context.venue.id);
  if (error) return { ok: false, message: playlistSqlMessage(error.message) };
  revalidatePlaylists();
  return { ok: true, message: "Playlist item updated." };
}

export async function reorderPlaylistItemsAction(input: unknown): Promise<PlaylistActionResult> {
  const gate = await playlistsGate();
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = reorderPlaylistItemsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  for (const [index, id] of parsed.data.ids.entries()) {
    const { error } = await gate.supabase
      .from("screen_playlist_items")
      .update({ sort_order: index })
      .eq("id", id)
      .eq("playlist_id", parsed.data.playlistId)
      .eq("venue_id", gate.context.venue.id);
    if (error) return { ok: false, message: playlistSqlMessage(error.message) };
  }
  revalidatePlaylists();
  return { ok: true, message: "Playlist order saved." };
}

export async function archivePlaylistItemAction(id: string): Promise<PlaylistActionResult> {
  const gate = await playlistsGate();
  if (!gate.ok) return { ok: false, message: gate.message };
  const { error } = await gate.supabase
    .from("screen_playlist_items")
    .update({ archived_at: new Date().toISOString(), enabled: false })
    .eq("id", id)
    .eq("venue_id", gate.context.venue.id);
  if (error) return { ok: false, message: playlistSqlMessage(error.message) };
  revalidatePlaylists();
  return { ok: true, message: "Removed from playlist." };
}

export async function createMenuSpecialRecordAction(input: unknown): Promise<PlaylistActionResult> {
  try {
    const gate = await playlistsGate();
    if (!gate.ok) return { ok: false, message: gate.message };
    const parsed = createMenuSpecialRecordSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

    const { error } = await gate.supabase.from("menu_specials").insert({
      id: parsed.data.id,
      venue_id: gate.context.venue.id,
      title: parsed.data.title,
      subtitle: parsed.data.subtitle,
      category: parsed.data.category,
      price_label: parsed.data.priceLabel,
      storage_path: parsed.data.storagePath,
      public_url: parsed.data.publicUrl,
      media_kind: parsed.data.mediaKind,
      duration_seconds: parsed.data.durationSeconds,
      starts_at: parsed.data.startsAt ?? null,
      ends_at: parsed.data.endsAt ?? null,
      enabled: parsed.data.enabled,
    });
    if (error) return { ok: false, message: playlistSqlMessage(error.message) };

    if (parsed.data.addToPlaylistId) {
      const sortOrder = await nextItemSortOrder(
        gate.supabase,
        parsed.data.addToPlaylistId,
        gate.context.venue.id,
      );
      const { error: itemError } = await gate.supabase.from("screen_playlist_items").insert({
        playlist_id: parsed.data.addToPlaylistId,
        venue_id: gate.context.venue.id,
        source_kind: "special",
        special_id: parsed.data.id,
        duration_seconds: parsed.data.durationSeconds,
        transition: "fade",
        sort_order: sortOrder,
        enabled: true,
      });
      if (itemError) return { ok: false, message: playlistSqlMessage(itemError.message) };
    }

    revalidatePlaylists();
    return {
      ok: true,
      id: parsed.data.id,
      message: parsed.data.addToPlaylistId
        ? "Special saved and added to the playlist."
        : "Special saved. Add it to a playlist when you want it on screens.",
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not save the special." };
  }
}

export async function updateMenuSpecialAction(input: unknown): Promise<PlaylistActionResult> {
  const gate = await playlistsGate();
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = updateMenuSpecialSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: fieldMessage(parsed.error) };

  const { error } = await gate.supabase
    .from("menu_specials")
    .update({
      title: parsed.data.title,
      subtitle: parsed.data.subtitle,
      category: parsed.data.category,
      price_label: parsed.data.priceLabel,
      duration_seconds: parsed.data.durationSeconds,
      starts_at: parsed.data.startsAt ?? null,
      ends_at: parsed.data.endsAt ?? null,
      enabled: parsed.data.enabled,
    })
    .eq("id", parsed.data.id)
    .eq("venue_id", gate.context.venue.id);
  if (error) return { ok: false, message: playlistSqlMessage(error.message) };
  revalidatePlaylists();
  return { ok: true, message: "Special updated." };
}

export async function archiveMenuSpecialAction(id: string): Promise<PlaylistActionResult> {
  const gate = await playlistsGate();
  if (!gate.ok) return { ok: false, message: gate.message };
  const { error } = await gate.supabase
    .from("menu_specials")
    .update({ archived_at: new Date().toISOString(), enabled: false })
    .eq("id", id)
    .eq("venue_id", gate.context.venue.id);
  if (error) return { ok: false, message: playlistSqlMessage(error.message) };
  revalidatePlaylists();
  return { ok: true, message: "Special archived." };
}
