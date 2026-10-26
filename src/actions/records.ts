"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getStaffContext } from "@/lib/auth/staff";
import { authorizeProgramming, authorizeVenueSettings } from "@/lib/auth/permissions";
import { eventFormSchema, artistFormSchema, bulkEventActionSchema, profileSettingsSchema, venueSettingsSchema } from "@/lib/validation/schemas";
import {
  bulkEventUpdateFields,
  planBulkEventUpdate,
  summarizeBulkEventUpdate,
  type BulkEventSnapshot,
} from "@/lib/events/bulk";
import { parseVenueLocalDateTime } from "@/lib/timezone";
import { revalidatePublicSurfaces } from "@/lib/public/revalidate";
import { isMissingProductionRelation } from "@/lib/queries/production";
import { isMissingLedWallRelation } from "@/lib/screens/led-wall";
import { z } from "zod";

export type ActionResult = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
  id?: string;
};

function fieldErrorsFromZod(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "form";
    fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
  }
  return fieldErrors;
}

async function staffForMutation() {
  const context = await getStaffContext();
  if (context.status === "unconfigured") {
    return { ok: false as const, message: "Supabase is not configured." };
  }
  if (context.status === "unauthenticated") {
    return { ok: false as const, message: "Sign in required." };
  }
  if (context.status === "denied") {
    return { ok: false as const, message: "You do not have staff access." };
  }
  if (context.status === "error") {
    return { ok: false as const, message: context.message };
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { ok: false as const, message: "Supabase is not configured." };
  }
  return { ok: true as const, context, supabase };
}

function revalidateOps() {
  revalidatePublicSurfaces();
}

export async function saveEventAction(input: unknown, eventId?: string): Promise<ActionResult> {
  const gate = await staffForMutation();
  if (!gate.ok) return { ok: false, message: gate.message };
  const allowed = authorizeProgramming(gate.context.role);
  if (!allowed.allowed) return { ok: false, message: allowed.reason };

  const parsed = eventFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const values = parsed.data;
  const start = parseVenueLocalDateTime(values.startDate, values.startTime, values.timeZone);
  const end = parseVenueLocalDateTime(values.endDate, values.endTime, values.timeZone);
  if (!start.ok) return { ok: false, message: start.message };
  if (!end.ok) return { ok: false, message: end.message };

  const fields = {
    title: values.title,
    event_type: values.eventType,
    starts_at: start.iso,
    ends_at: end.iso,
    location_label: values.locationLabel,
    public_description: values.publicDescription,
    internal_notes: values.internalNotes,
    status: values.status,
    visibility: values.visibility,
    featured: values.featured,
    is_ticketed: values.isTicketed,
    ticket_url: values.ticketUrl,
    cover_label: values.coverLabel,
  };

  let id = eventId;
  if (eventId) {
    const { error } = await gate.supabase.from("events").update(fields).eq("id", eventId).eq("venue_id", gate.context.venue.id);
    if (error) return { ok: false, message: error.message };
  } else {
    const { data, error } = await gate.supabase
      .from("events")
      .insert({ ...fields, venue_id: gate.context.venue.id })
      .select("id")
      .single();
    if (error || !data) return { ok: false, message: error?.message ?? "Could not create event." };
    id = data.id;
  }

  const { error: deleteLinksError } = await gate.supabase
    .from("event_artists")
    .delete()
    .eq("event_id", id!)
    .eq("venue_id", gate.context.venue.id);
  if (deleteLinksError) return { ok: false, message: deleteLinksError.message };

  if (values.artistIds.length > 0) {
    const { data: artists, error: artistError } = await gate.supabase
      .from("artists")
      .select("id, venue_id")
      .in("id", values.artistIds);
    if (artistError) return { ok: false, message: artistError.message };
    const invalid = (artists ?? []).some((artist) => artist.venue_id !== gate.context.venue.id);
    if (invalid || (artists ?? []).length !== values.artistIds.length) {
      return { ok: false, message: "One or more artists do not belong to this venue." };
    }
    const rows = values.artistIds.map((artistId, index) => ({
      venue_id: gate.context.venue.id,
      event_id: id!,
      artist_id: artistId,
      display_order: index,
    }));
    const { error: insertLinksError } = await gate.supabase.from("event_artists").insert(rows);
    if (insertLinksError) return { ok: false, message: insertLinksError.message };
  }

  revalidateOps();
  revalidatePath(`/programming/${id}`);
  revalidatePath(`/programming/${id}/edit`);
  return { ok: true, message: eventId ? "Event saved." : "Event created.", id };
}

export async function setEventStatusAction(
  eventId: string,
  status: "draft" | "published" | "cancelled",
): Promise<ActionResult> {
  const gate = await staffForMutation();
  if (!gate.ok) return { ok: false, message: gate.message };
  const allowed = authorizeProgramming(gate.context.role);
  if (!allowed.allowed) return { ok: false, message: allowed.reason };

  const { error } = await gate.supabase
    .from("events")
    .update({ status })
    .eq("id", eventId)
    .eq("venue_id", gate.context.venue.id)
    .is("archived_at", null);

  if (error) return { ok: false, message: error.message };
  revalidateOps();
  revalidatePath(`/programming/${eventId}`);
  const messages = {
    draft: "Returned to draft. It no longer appears in the public listings, embed, or API.",
    published: "Published. Public listings, embed, and API include this event when visibility is public.",
    cancelled: "Event cancelled. Cancelled rows stay off the public listings.",
  };
  return { ok: true, message: messages[status], id: eventId };
}

export async function archiveEventAction(eventId: string): Promise<ActionResult> {
  const gate = await staffForMutation();
  if (!gate.ok) return { ok: false, message: gate.message };
  const allowed = authorizeProgramming(gate.context.role);
  if (!allowed.allowed) return { ok: false, message: allowed.reason };

  const { error } = await gate.supabase
    .from("events")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", eventId)
    .eq("venue_id", gate.context.venue.id);

  if (error) return { ok: false, message: error.message };
  revalidateOps();
  revalidatePath(`/programming/${eventId}`);
  return { ok: true, message: "Event archived.", id: eventId };
}

export async function bulkUpdateEventsAction(input: unknown): Promise<ActionResult & { updated?: number; skipped?: number }> {
  const gate = await staffForMutation();
  if (!gate.ok) return { ok: false, message: gate.message };
  const allowed = authorizeProgramming(gate.context.role);
  if (!allowed.allowed) return { ok: false, message: allowed.reason };

  const parsed = bulkEventActionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Choose a bulk action and at least one event.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const requestedIds = [...new Set(parsed.data.eventIds)];
  const { data, error } = await gate.supabase
    .from("events")
    .select("id, status, archived_at, visibility, featured")
    .eq("venue_id", gate.context.venue.id)
    .in("id", requestedIds);
  if (error) return { ok: false, message: error.message };

  const snapshots: BulkEventSnapshot[] = (data ?? []).map((row) => ({
    id: row.id,
    status: row.status,
    archivedAt: row.archived_at,
    visibility: row.visibility,
    featured: row.featured,
  }));
  const plan = planBulkEventUpdate(requestedIds, snapshots, parsed.data.action);
  if (plan.updateIds.length === 0) {
    return {
      ok: true,
      message: summarizeBulkEventUpdate(parsed.data.action, 0, plan.skipped.length),
      updated: 0,
      skipped: plan.skipped.length,
    };
  }

  const fields = bulkEventUpdateFields(parsed.data.action, new Date().toISOString());
  const base = gate.supabase.from("events").update(fields).eq("venue_id", gate.context.venue.id).in("id", plan.updateIds);
  const filtered = parsed.data.action === "restore" ? base.not("archived_at", "is", null) : base.is("archived_at", null);
  const { data: updatedRows, error: updateError } = await filtered.select("id");
  if (updateError) return { ok: false, message: updateError.message };

  const updated = updatedRows?.length ?? 0;
  const skipped = plan.skipped.length + (plan.updateIds.length - updated);
  revalidateOps();
  for (const id of updatedRows ?? []) {
    revalidatePath(`/programming/${id.id}`);
    revalidatePath(`/programming/${id.id}/edit`);
  }

  return {
    ok: true,
    message: summarizeBulkEventUpdate(parsed.data.action, updated, skipped),
    updated,
    skipped,
  };
}

export async function saveArtistAction(input: unknown, artistId?: string): Promise<ActionResult> {
  const gate = await staffForMutation();
  if (!gate.ok) return { ok: false, message: gate.message };
  const allowed = authorizeProgramming(gate.context.role);
  if (!allowed.allowed) return { ok: false, message: allowed.reason };

  const parsed = artistFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Check the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const fields = {
    name: parsed.data.name,
    genre: parsed.data.genre,
    bio: parsed.data.bio,
    website_url: parsed.data.websiteUrl,
  };

  if (artistId) {
    const { error } = await gate.supabase
      .from("artists")
      .update(fields)
      .eq("id", artistId)
      .eq("venue_id", gate.context.venue.id);
    if (error) return { ok: false, message: error.message };
    revalidateOps();
    revalidatePath(`/artists/${artistId}`);
    return { ok: true, message: "Artist saved.", id: artistId };
  }

  const { data, error } = await gate.supabase
    .from("artists")
    .insert({ ...fields, venue_id: gate.context.venue.id })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "Could not create artist." };
  revalidateOps();
  return { ok: true, message: "Artist created.", id: data.id };
}

export async function archiveArtistAction(artistId: string): Promise<ActionResult> {
  const gate = await staffForMutation();
  if (!gate.ok) return { ok: false, message: gate.message };
  const allowed = authorizeProgramming(gate.context.role);
  if (!allowed.allowed) return { ok: false, message: allowed.reason };

  const { error } = await gate.supabase
    .from("artists")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", artistId)
    .eq("venue_id", gate.context.venue.id);
  if (error) return { ok: false, message: error.message };
  revalidateOps();
  revalidatePath(`/artists/${artistId}`);
  return { ok: true, message: "Artist archived. Historical event links are unchanged.", id: artistId };
}

const mergeArtistsSchema = z.object({
  keepArtistId: z.string().uuid(),
  mergeArtistId: z.string().uuid(),
  preferredName: z.string().trim().min(1).max(160).optional(),
  /** Which artist's LED wall graphic wins when both have one. Default: keep. */
  wallFrom: z.enum(["keep", "merge"]).default("keep"),
});

/**
 * Merge a duplicate artist into a keeper: reassign event links, LED wall config,
 * production session artist ids, then archive the duplicate.
 */
export async function mergeArtistsAction(input: unknown): Promise<ActionResult> {
  const gate = await staffForMutation();
  if (!gate.ok) return { ok: false, message: gate.message };
  const allowed = authorizeProgramming(gate.context.role);
  if (!allowed.allowed) return { ok: false, message: allowed.reason };

  const parsed = mergeArtistsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Check the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const { keepArtistId, mergeArtistId, preferredName, wallFrom } = parsed.data;
  if (keepArtistId === mergeArtistId) {
    return { ok: false, message: "Pick two different artists to merge." };
  }

  const venueId = gate.context.venue.id;
  const { data: artists, error: artistsError } = await gate.supabase
    .from("artists")
    .select("id, name, venue_id, archived_at")
    .eq("venue_id", venueId)
    .in("id", [keepArtistId, mergeArtistId]);
  if (artistsError) return { ok: false, message: artistsError.message };

  const keep = artists?.find((row) => row.id === keepArtistId);
  const merge = artists?.find((row) => row.id === mergeArtistId);
  if (!keep || !merge) return { ok: false, message: "One or both artists were not found." };
  if (keep.archived_at) return { ok: false, message: "The artist you want to keep is archived." };
  if (merge.archived_at) return { ok: false, message: "That duplicate is already archived." };

  const { data: mergeLinks, error: linksError } = await gate.supabase
    .from("event_artists")
    .select("event_id, display_order")
    .eq("venue_id", venueId)
    .eq("artist_id", mergeArtistId);
  if (linksError) return { ok: false, message: linksError.message };

  const { data: keepLinks, error: keepLinksError } = await gate.supabase
    .from("event_artists")
    .select("event_id")
    .eq("venue_id", venueId)
    .eq("artist_id", keepArtistId);
  if (keepLinksError) return { ok: false, message: keepLinksError.message };

  const keepEventIds = new Set((keepLinks ?? []).map((row) => row.event_id));
  const toMove = (mergeLinks ?? []).filter((row) => !keepEventIds.has(row.event_id));
  const toDrop = (mergeLinks ?? []).filter((row) => keepEventIds.has(row.event_id));

  if (toDrop.length > 0) {
    const { error } = await gate.supabase
      .from("event_artists")
      .delete()
      .eq("venue_id", venueId)
      .eq("artist_id", mergeArtistId)
      .in(
        "event_id",
        toDrop.map((row) => row.event_id),
      );
    if (error) return { ok: false, message: error.message };
  }

  if (toMove.length > 0) {
    const { error: deleteMoveError } = await gate.supabase
      .from("event_artists")
      .delete()
      .eq("venue_id", venueId)
      .eq("artist_id", mergeArtistId)
      .in(
        "event_id",
        toMove.map((row) => row.event_id),
      );
    if (deleteMoveError) return { ok: false, message: deleteMoveError.message };

    const { error: insertMoveError } = await gate.supabase.from("event_artists").insert(
      toMove.map((row) => ({
        venue_id: venueId,
        event_id: row.event_id,
        artist_id: keepArtistId,
        display_order: row.display_order,
      })),
    );
    if (insertMoveError) return { ok: false, message: insertMoveError.message };
  }

  const { data: scenes, error: scenesError } = await gate.supabase
    .from("led_wall_scenes")
    .select("id, artist_id, title, enabled")
    .eq("venue_id", venueId)
    .in("artist_id", [keepArtistId, mergeArtistId]);
  const scenesUnavailable =
    Boolean(scenesError) &&
    (isMissingLedWallRelation(scenesError!.message) ||
      (/artist_id/i.test(scenesError!.message) && /does not exist|schema cache|could not find/i.test(scenesError!.message)));
  if (scenesError && !scenesUnavailable) return { ok: false, message: scenesError.message };

  const keepScene = scenesUnavailable
    ? null
    : ((scenes ?? []).find((row) => row.artist_id === keepArtistId) ?? null);
  const mergeScene = scenesUnavailable
    ? null
    : ((scenes ?? []).find((row) => row.artist_id === mergeArtistId) ?? null);

  const preferMergeWall = wallFrom === "merge" ? Boolean(mergeScene) : !keepScene && Boolean(mergeScene);

  if (!scenesUnavailable) {
    if (preferMergeWall && mergeScene) {
      if (keepScene) {
        const { error } = await gate.supabase
          .from("led_wall_scenes")
          .delete()
          .eq("id", keepScene.id)
          .eq("venue_id", venueId);
        if (error) return { ok: false, message: error.message };
      }
      const { error } = await gate.supabase
        .from("led_wall_scenes")
        .update({ artist_id: keepArtistId })
        .eq("id", mergeScene.id)
        .eq("venue_id", venueId);
      if (error) return { ok: false, message: error.message };
    } else if (mergeScene) {
      const { error } = await gate.supabase
        .from("led_wall_scenes")
        .delete()
        .eq("id", mergeScene.id)
        .eq("venue_id", venueId);
      if (error) return { ok: false, message: error.message };
    }
  }

  const { error: runtimeError } = await gate.supabase
    .from("led_wall_runtime")
    .update({ auto_artist_id: keepArtistId })
    .eq("venue_id", venueId)
    .eq("auto_artist_id", mergeArtistId);
  if (
    runtimeError &&
    !isMissingLedWallRelation(runtimeError.message) &&
    !(/auto_artist_id/i.test(runtimeError.message) && /does not exist|schema cache|could not find/i.test(runtimeError.message))
  ) {
    return { ok: false, message: runtimeError.message };
  }

  // Optional: production desk may not be migrated on every venue yet.
  const { data: sessions, error: sessionsError } = await gate.supabase
    .from("production_sessions")
    .select("id, artist_ids")
    .eq("venue_id", venueId)
    .contains("artist_ids", [mergeArtistId]);
  if (sessionsError && !isMissingProductionRelation(sessionsError.message)) {
    return { ok: false, message: sessionsError.message };
  }

  if (!sessionsError) {
    for (const session of sessions ?? []) {
      const nextIds = [
        ...new Set(session.artist_ids.map((id) => (id === mergeArtistId ? keepArtistId : id))),
      ];
      const { error } = await gate.supabase
        .from("production_sessions")
        .update({ artist_ids: nextIds })
        .eq("id", session.id)
        .eq("venue_id", venueId);
      if (error && !isMissingProductionRelation(error.message)) {
        return { ok: false, message: error.message };
      }
    }
  }

  if (preferredName && preferredName !== keep.name) {
    const { error } = await gate.supabase
      .from("artists")
      .update({ name: preferredName })
      .eq("id", keepArtistId)
      .eq("venue_id", venueId);
    if (error) return { ok: false, message: error.message };
  }

  const { error: archiveError } = await gate.supabase
    .from("artists")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", mergeArtistId)
    .eq("venue_id", venueId);
  if (archiveError) return { ok: false, message: archiveError.message };

  revalidateOps();
  revalidatePath(`/artists/${keepArtistId}`);
  revalidatePath(`/artists/${mergeArtistId}`);
  revalidatePath("/screens");
  revalidatePath("/display/led");

  const moved = toMove.length;
  const wallNote = scenesUnavailable
    ? " LED wall tables were unavailable, so graphics were left as-is."
    : preferMergeWall
      ? " LED wall graphic moved onto the kept artist."
      : keepScene
        ? " Kept the surviving artist's LED wall graphic."
        : mergeScene
          ? ""
          : " Neither artist had an LED wall graphic.";

  return {
    ok: true,
    message: `Merged “${merge.name}” into “${preferredName?.trim() || keep.name}” (${moved} event link${moved === 1 ? "" : "s"}).${wallNote}`,
    id: keepArtistId,
  };
}

export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  const gate = await staffForMutation();
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = profileSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Check the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const { error } = await gate.supabase
    .from("profiles")
    .upsert({ id: gate.context.userId, display_name: parsed.data.displayName });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/settings");
  return { ok: true, message: "Display name saved." };
}

export async function updateVenueAction(input: unknown): Promise<ActionResult> {
  const gate = await staffForMutation();
  if (!gate.ok) return { ok: false, message: gate.message };
  const allowed = authorizeVenueSettings(gate.context.role);
  if (!allowed.allowed) return { ok: false, message: allowed.reason };

  const parsed = venueSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Check the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const { error } = await gate.supabase
    .from("venues")
    .update({ name: parsed.data.name })
    .eq("id", gate.context.venue.id);
  if (error) return { ok: false, message: error.message };
  revalidateOps();
  return { ok: true, message: "Venue name saved." };
}

export async function signOutAction() {
  const supabase = await createServerSupabaseClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  redirect("/login");
}

export async function signOutWallOpsAction() {
  const supabase = await createServerSupabaseClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  redirect("/wall");
}
