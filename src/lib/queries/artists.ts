import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { EventRow } from "@/lib/queries/events";

type Client = SupabaseClient<Database>;

export type ArtistRow = Database["public"]["Tables"]["artists"]["Row"];

export async function listArtists(
  client: Client,
  venueId: string,
  options: { query: string; includeArchived: boolean; page: number; pageSize: number },
) {
  let query = client
    .from("artists")
    .select("*", { count: "exact" })
    .eq("venue_id", venueId)
    .order("name", { ascending: true });

  if (!options.includeArchived) {
    query = query.is("archived_at", null);
  }
  if (options.query) {
    query = query.or(`name.ilike.%${options.query}%,genre.ilike.%${options.query}%`);
  }

  const from = (options.page - 1) * options.pageSize;
  const { data, error, count } = await query.range(from, from + options.pageSize - 1);
  if (error) return { artists: [] as ArtistRow[], count: 0, error: error.message };
  return { artists: (data ?? []) as ArtistRow[], count: count ?? 0, error: null };
}

export async function searchActiveArtists(client: Client, venueId: string, query: string) {
  let request = client
    .from("artists")
    .select("id, name, genre, archived_at")
    .eq("venue_id", venueId)
    .is("archived_at", null)
    .order("name", { ascending: true })
    .limit(25);

  if (query.trim()) {
    request = request.ilike("name", `%${query.trim()}%`);
  }

  const { data, error } = await request;
  if (error) return { artists: [], error: error.message };
  return { artists: data ?? [], error: null };
}

export async function getArtistById(client: Client, id: string) {
  const { data, error } = await client.from("artists").select("*").eq("id", id).maybeSingle();
  if (error) return { artist: null, error: error.message };
  return { artist: data as ArtistRow | null, error: null };
}

export async function artistNameMatches(client: Client, venueId: string, name: string, excludeId?: string) {
  let query = client
    .from("artists")
    .select("id, name")
    .eq("venue_id", venueId)
    .ilike("name", name.trim());

  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query.limit(5);
  if (error) return { matches: [], error: error.message };
  return { matches: data ?? [], error: null };
}

export async function listArtistEvents(client: Client, venueId: string, artistId: string, nowIso: string) {
  const { data, error } = await client
    .from("event_artists")
    .select(
      `
      display_order,
      events (
        *,
        event_artists (
          artist_id,
          display_order,
          artists ( id, name, archived_at )
        )
      )
    `,
    )
    .eq("venue_id", venueId)
    .eq("artist_id", artistId);

  if (error) return { upcoming: [] as EventRow[], past: [] as EventRow[], error: error.message };

  const events = (data ?? [])
    .map((row) => row.events as unknown as EventRow | EventRow[] | null)
    .map((value) => (Array.isArray(value) ? value[0] : value))
    .filter((event): event is EventRow => event != null && event.archived_at === null);

  const upcoming = events
    .filter((event) => event.ends_at >= nowIso && event.status !== "cancelled")
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = events
    .filter((event) => event.ends_at < nowIso || event.status === "cancelled")
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));

  return { upcoming, past, error: null };
}
