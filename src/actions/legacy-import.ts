"use server";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePublicSurfaces } from "@/lib/public/revalidate";
import { parseLegacySheet, type ParsedLegacyEvent } from "@/lib/legacy/parser";
import { authorizeProgramming } from "@/lib/auth/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getStaffContext } from "@/lib/auth/staff";

export type ImportLegacyResult = {
  ok: boolean;
  message: string;
  created: number;
  updated: number;
  artistsCreated: number;
  imported: number;
};

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

function findArtistId(artists: Array<{ id: string; name: string }>, name: string) {
  const key = name.trim().toLowerCase();
  return artists.find((artist) => artist.name.trim().toLowerCase() === key)?.id;
}

export async function importLegacyEventsAction(): Promise<ImportLegacyResult> {
  const gate = await staffForImport();
  if (!gate.ok) {
    return { ok: false, message: gate.message, created: 0, updated: 0, artistsCreated: 0, imported: 0 };
  }
  const allowed = authorizeProgramming(gate.context.role);
  if (!allowed.allowed) {
    return { ok: false, message: allowed.reason, created: 0, updated: 0, artistsCreated: 0, imported: 0 };
  }

  const csvPath = path.join(process.cwd(), "data", "legacy-events.csv");
  let csv: string;
  try {
    csv = await readFile(csvPath, "utf8");
  } catch {
    return {
      ok: false,
      message: "Could not read data/legacy-events.csv.",
      created: 0,
      updated: 0,
      artistsCreated: 0,
      imported: 0,
    };
  }

  const parsed = parseLegacySheet(csv, gate.context.venue.timezone);
  const { data: existingEvents, error: existingError } = await gate.supabase
    .from("events")
    .select("id, legacy_source_id, featured")
    .eq("venue_id", gate.context.venue.id)
    .not("legacy_source_id", "is", null);
  if (existingError) {
    return { ok: false, message: existingError.message, created: 0, updated: 0, artistsCreated: 0, imported: 0 };
  }

  const { data: existingArtists, error: artistError } = await gate.supabase
    .from("artists")
    .select("id, name")
    .eq("venue_id", gate.context.venue.id);
  if (artistError) {
    return { ok: false, message: artistError.message, created: 0, updated: 0, artistsCreated: 0, imported: 0 };
  }

  const byLegacy = new Map(
    (existingEvents ?? [])
      .filter((row) => row.legacy_source_id)
      .map((row) => [row.legacy_source_id as string, row]),
  );
  const artists = [...(existingArtists ?? [])];
  let created = 0;
  let updated = 0;
  let artistsCreated = 0;

  for (const row of parsed.importable) {
    const result = await upsertLegacyEvent(gate.supabase, gate.context.venue.id, row, byLegacy.get(row.legacySourceId) ?? null);
    if (!result.ok) {
      return { ok: false, message: result.message, created, updated, artistsCreated, imported: created + updated };
    }
    if (result.created) created += 1;
    else updated += 1;
    byLegacy.set(row.legacySourceId, { id: result.id, legacy_source_id: row.legacySourceId, featured: false });

    const artistResult = await ensureLegacyArtist(
      gate.supabase,
      gate.context.venue.id,
      result.id,
      row,
      artists,
    );
    if (!artistResult.ok) {
      return { ok: false, message: artistResult.message, created, updated, artistsCreated, imported: created + updated };
    }
    artistsCreated += artistResult.created ? 1 : 0;
    if (artistResult.artist) {
      if (!artists.some((item) => item.id === artistResult.artist!.id)) {
        artists.push(artistResult.artist);
      }
    }
  }

  revalidatePublicSurfaces();
  return {
    ok: true,
    message: `Imported ${parsed.importable.length} public listings (${created} new, ${updated} updated).`,
    created,
    updated,
    artistsCreated,
    imported: parsed.importable.length,
  };
}

async function upsertLegacyEvent(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  venueId: string,
  row: ParsedLegacyEvent,
  existing: { id: string; featured: boolean } | null,
): Promise<{ ok: true; id: string; created: boolean } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase is not configured." };
  const fields = {
    title: row.title,
    event_type: row.eventType,
    starts_at: row.startsAtIso,
    ends_at: row.endsAtIso,
    location_label: "FloBama Music Hall",
    internal_notes: row.internalNotes,
    status: "published" as const,
    visibility: "public" as const,
    is_ticketed: row.isTicketed,
    ticket_url: row.ticketUrl,
    cover_label: row.coverLabel,
    legacy_source_id: row.legacySourceId,
    archived_at: null,
  };

  if (existing) {
    const { error } = await supabase.from("events").update(fields).eq("id", existing.id).eq("venue_id", venueId);
    if (error) return { ok: false, message: error.message };
    return { ok: true, id: existing.id, created: false };
  }

  const { data, error } = await supabase
    .from("events")
    .insert({ ...fields, venue_id: venueId, featured: false })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "Could not create event." };
  return { ok: true, id: data.id, created: true };
}

async function ensureLegacyArtist(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  venueId: string,
  eventId: string,
  row: ParsedLegacyEvent,
  artists: Array<{ id: string; name: string }>,
): Promise<
  | { ok: true; created: boolean; artist: { id: string; name: string } | null }
  | { ok: false; message: string }
> {
  if (!supabase) return { ok: false, message: "Supabase is not configured." };

  const { error: clearError } = await supabase
    .from("event_artists")
    .delete()
    .eq("event_id", eventId)
    .eq("venue_id", venueId);
  if (clearError) return { ok: false, message: clearError.message };

  if (!row.artistName || /^karaoke$/i.test(row.artistName)) {
    return { ok: true, created: false, artist: null };
  }

  let artistId = findArtistId(artists, row.artistName);
  let created = false;
  if (!artistId) {
    const { data, error } = await supabase
      .from("artists")
      .insert({ venue_id: venueId, name: row.artistName })
      .select("id, name")
      .single();
    if (error || !data) return { ok: false, message: error?.message ?? "Could not create artist." };
    artistId = data.id;
    created = true;
    artists.push(data);
  }

  const { error: linkError } = await supabase.from("event_artists").insert({
    venue_id: venueId,
    event_id: eventId,
    artist_id: artistId,
    display_order: 0,
  });
  if (linkError) return { ok: false, message: linkError.message };
  return { ok: true, created, artist: { id: artistId, name: row.artistName } };
}
