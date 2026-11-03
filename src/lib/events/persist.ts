import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { EventStatus, EventType, EventVisibility } from "@/lib/constants";
import { parseVenueLocalDateTime } from "@/lib/timezone";
import type { EventFormValues } from "@/lib/validation/schemas";

type Client = SupabaseClient<Database>;

/** Columns the staff form and the integration API both write on public.events. */
export const EVENT_WRITE_COLUMNS = [
  "title",
  "public_description",
  "internal_notes",
  "event_type",
  "starts_at",
  "ends_at",
  "location_label",
  "status",
  "visibility",
  "featured",
  "is_ticketed",
  "ticket_url",
  "cover_label",
] as const;

export type EventWriteFields = {
  title: string;
  public_description: string | null;
  internal_notes: string | null;
  event_type: EventType;
  starts_at: string;
  ends_at: string;
  location_label: string | null;
  status: EventStatus;
  visibility: EventVisibility;
  featured: boolean;
  is_ticketed: boolean;
  ticket_url: string | null;
  cover_label: string | null;
};

export const ARTIST_VENUE_MISMATCH_MESSAGE = "One or more artists do not belong to this venue.";

export function eventWriteFieldsFromForm(
  values: EventFormValues,
): { ok: true; fields: EventWriteFields } | { ok: false; message: string } {
  const start = parseVenueLocalDateTime(values.startDate, values.startTime, values.timeZone);
  const end = parseVenueLocalDateTime(values.endDate, values.endTime, values.timeZone);
  if (!start.ok) return { ok: false, message: start.message };
  if (!end.ok) return { ok: false, message: end.message };
  if (end.dateTime <= start.dateTime) {
    return {
      ok: false,
      message: "End must be after start. Overnight events should use the next calendar date.",
    };
  }

  return {
    ok: true,
    fields: {
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
    },
  };
}

export function artistIdsBelongToVenue(
  artists: Array<{ id: string; venue_id: string }>,
  venueId: string,
  artistIds: string[],
): boolean {
  if (artistIds.length === 0) return true;
  const byId = new Map(artists.map((artist) => [artist.id, artist.venue_id]));
  return artistIds.every((artistId) => byId.get(artistId) === venueId);
}

export async function syncEventArtists(
  client: Client,
  venueId: string,
  eventId: string,
  artistIds: string[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error: deleteLinksError } = await client
    .from("event_artists")
    .delete()
    .eq("event_id", eventId)
    .eq("venue_id", venueId);
  if (deleteLinksError) return { ok: false, message: deleteLinksError.message };

  if (artistIds.length === 0) return { ok: true };

  const { data: artists, error: artistError } = await client
    .from("artists")
    .select("id, venue_id")
    .in("id", artistIds);
  if (artistError) return { ok: false, message: artistError.message };
  if (!artistIdsBelongToVenue(artists ?? [], venueId, artistIds)) {
    return { ok: false, message: ARTIST_VENUE_MISMATCH_MESSAGE };
  }

  const rows = artistIds.map((artistId, index) => ({
    venue_id: venueId,
    event_id: eventId,
    artist_id: artistId,
    display_order: index,
  }));
  const { error: insertLinksError } = await client.from("event_artists").insert(rows);
  if (insertLinksError) return { ok: false, message: insertLinksError.message };
  return { ok: true };
}
