"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getStaffContext } from "@/lib/auth/staff";
import { authorizeProgramming, authorizeVenueSettings } from "@/lib/auth/permissions";
import { eventFormSchema, artistFormSchema, profileSettingsSchema, venueSettingsSchema } from "@/lib/validation/schemas";
import { parseVenueLocalDateTime } from "@/lib/timezone";
import { revalidatePublicSurfaces } from "@/lib/public/revalidate";
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
