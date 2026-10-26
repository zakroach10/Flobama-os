"use server";

import { findArtistIdByName } from "@/lib/artists/names";
import { authorizeProgramming } from "@/lib/auth/permissions";
import { getStaffContext } from "@/lib/auth/staff";
import { parseEventCsv } from "@/lib/events/csv";
import { revalidatePublicSurfaces } from "@/lib/public/revalidate";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { importEventsCsvSchema } from "@/lib/validation/schemas";

export type ImportEventsCsvResult = {
  ok: boolean;
  message: string;
  created: number;
  artistsCreated: number;
  errors: string[];
};

const empty = { created: 0, artistsCreated: 0, errors: [] as string[] };

async function staffForImport() {
  const context = await getStaffContext();
  if (context.status === "unconfigured") return { ok: false as const, message: "Supabase is not configured." };
  if (context.status === "unauthenticated") return { ok: false as const, message: "Sign in required." };
  if (context.status === "denied") return { ok: false as const, message: "You do not have staff access." };
  if (context.status === "error") return { ok: false as const, message: context.message };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { ok: false as const, message: "Supabase is not configured." };
  return { ok: true as const, context, supabase };
}

export async function importEventsCsvAction(input: unknown): Promise<ImportEventsCsvResult> {
  const gate = await staffForImport();
  if (!gate.ok) return { ok: false, message: gate.message, ...empty };

  const allowed = authorizeProgramming(gate.context.role);
  if (!allowed.allowed) return { ok: false, message: allowed.reason, ...empty };

  const parsedInput = importEventsCsvSchema.safeParse(input);
  if (!parsedInput.success) {
    return { ok: false, message: "Paste or upload a CSV file to import.", ...empty };
  }

  const { events, errors } = parseEventCsv(parsedInput.data.csvText, gate.context.venue.timezone);
  if (errors.length > 0) {
    return {
      ok: false,
      message: errors[0]!,
      created: 0,
      artistsCreated: 0,
      errors: errors.slice(0, 20),
    };
  }
  if (events.length === 0) {
    return { ok: false, message: "No events found in the spreadsheet.", ...empty };
  }

  const { data: existingArtists, error: artistError } = await gate.supabase
    .from("artists")
    .select("id, name")
    .eq("venue_id", gate.context.venue.id)
    .is("archived_at", null);
  if (artistError) return { ok: false, message: artistError.message, ...empty };

  const artists = [...(existingArtists ?? [])];
  let created = 0;
  let artistsCreated = 0;

  for (const row of events) {
    const { data, error } = await gate.supabase
      .from("events")
      .insert({
        venue_id: gate.context.venue.id,
        title: row.title,
        event_type: row.eventType,
        starts_at: row.startsAtIso,
        ends_at: row.endsAtIso,
        location_label: row.locationLabel,
        public_description: row.publicDescription,
        internal_notes: row.internalNotes,
        status: row.status,
        visibility: row.visibility,
        featured: row.featured,
        is_ticketed: row.isTicketed,
        ticket_url: row.ticketUrl,
        cover_label: row.coverLabel,
      })
      .select("id")
      .single();
    if (error || !data) {
      return {
        ok: false,
        message: error?.message ?? `Could not create event on row ${row.line}.`,
        created,
        artistsCreated,
        errors: [],
      };
    }

    created += 1;
    const artistIds: string[] = [];
    for (const name of row.artistNames) {
      let artistId = findArtistIdByName(artists, name);
      if (!artistId) {
        const { data: artist, error: createError } = await gate.supabase
          .from("artists")
          .insert({ venue_id: gate.context.venue.id, name })
          .select("id, name")
          .single();
        if (createError || !artist) {
          return {
            ok: false,
            message: createError?.message ?? `Could not create artist "${name}".`,
            created,
            artistsCreated,
            errors: [],
          };
        }
        artistId = artist.id;
        artists.push(artist);
        artistsCreated += 1;
      }
      artistIds.push(artistId);
    }

    if (artistIds.length > 0) {
      const links = artistIds.map((artistId, index) => ({
        venue_id: gate.context.venue.id,
        event_id: data.id,
        artist_id: artistId,
        display_order: index,
      }));
      const { error: linkError } = await gate.supabase.from("event_artists").insert(links);
      if (linkError) {
        return {
          ok: false,
          message: linkError.message,
          created,
          artistsCreated,
          errors: [],
        };
      }
    }
  }

  revalidatePublicSurfaces();
  return {
    ok: true,
    message: `Imported ${created} event${created === 1 ? "" : "s"}${
      artistsCreated > 0 ? ` (${artistsCreated} new artist${artistsCreated === 1 ? "" : "s"})` : ""
    }.`,
    created,
    artistsCreated,
    errors: [],
  };
}
