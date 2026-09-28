import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { EventListFilters } from "@/lib/queries/filters";
import { parseVenueLocalDateTime } from "@/lib/timezone";

export type EventRow = Database["public"]["Tables"]["events"]["Row"] & {
  event_artists: Array<{
    artist_id: string;
    display_order: number;
    artists: { id: string; name: string; archived_at: string | null; led_wall_scene_id: string | null } | null;
  }>;
};

export function artistNames(event: EventRow): string[] {
  return [...event.event_artists]
    .sort((a, b) => a.display_order - b.display_order)
    .map((row) => row.artists?.name)
    .filter((name): name is string => Boolean(name));
}

type Client = SupabaseClient<Database>;

const EVENT_SELECT = `
  *,
  event_artists (
    artist_id,
    display_order,
    artists ( id, name, archived_at, led_wall_scene_id )
  )
`;

export async function getEventById(client: Client, id: string) {
  const { data, error } = await client
    .from("events")
    .select(EVENT_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) return { event: null, error: error.message };
  return { event: data as unknown as EventRow | null, error: null };
}

export async function listEvents(
  client: Client,
  venueId: string,
  filters: EventListFilters,
  nowIso: string,
) {
  return searchEvents(client, venueId, filters, nowIso);
}

async function matchingEventIds(client: Client, venueId: string, query: string) {
  const { data } = await client
    .from("event_artists")
    .select("event_id, artists!inner(name)")
    .eq("venue_id", venueId)
    .ilike("artists.name", `%${query}%`);
  const ids = [...new Set((data ?? []).map((row) => row.event_id))];
  return ids.length > 0 ? ids.join(",") : "00000000-0000-0000-0000-000000000000";
}

export async function searchEvents(client: Client, venueId: string, filters: EventListFilters, nowIso: string) {
  let query = client.from("events").select(EVENT_SELECT, { count: "exact" }).eq("venue_id", venueId);

  if (filters.query) {
    const idsFromArtists = await matchingEventIds(client, venueId, filters.query);
    query = query.or(`title.ilike.%${filters.query}%,id.in.(${idsFromArtists})`);
  }
  if (filters.window === "archived") query = query.not("archived_at", "is", null);
  else query = query.is("archived_at", null);
  if (filters.window === "upcoming") query = query.gte("ends_at", nowIso).neq("status", "cancelled");
  if (filters.window === "past") query = query.lt("ends_at", nowIso);
  if (filters.window === "cancelled") query = query.eq("status", "cancelled");
  if (filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.eventType !== "all") query = query.eq("event_type", filters.eventType);
  if (filters.fromDate) {
    const start = parseVenueLocalDateTime(filters.fromDate, "00:00", filters.timeZone);
    if (start.ok) query = query.gte("starts_at", start.iso);
  }
  if (filters.toDate) {
    const end = parseVenueLocalDateTime(filters.toDate, "23:59", filters.timeZone);
    if (end.ok) query = query.lte("starts_at", end.iso);
  }

  const from = (filters.page - 1) * filters.pageSize;
  const { data, error, count } = await query
    .order("starts_at", { ascending: filters.window !== "past" })
    .range(from, from + filters.pageSize - 1);

  if (error) return { events: [] as EventRow[], count: 0, error: error.message };
  return { events: (data ?? []) as unknown as EventRow[], count: count ?? 0, error: null };
}
