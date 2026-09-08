import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { DEFAULT_VENUE_TIMEZONE } from "@/lib/constants";
import { toPublicEventJson, type PublicEventJson } from "@/lib/public/listings";
import { venueDayBounds, venueWeekBounds } from "@/lib/timezone";

type Client = SupabaseClient<Database>;
type ListingRow = Database["public"]["Views"]["event_listings"]["Row"];

function listingToStaff(row: ListingRow, artists: string[]) {
  return {
    id: row.id,
    title: row.title,
    event_type: row.event_type,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    location_label: row.location_label,
    featured: row.featured,
    is_ticketed: row.is_ticketed,
    ticket_url: row.ticket_url,
    cover_label: row.cover_label,
    status: "published" as const,
    visibility: "public" as const,
    archived_at: null,
    artists,
  };
}

async function artistsByEvent(client: Client, eventIds: string[]) {
  const map = new Map<string, string[]>();
  if (eventIds.length === 0) return map;
  const { data, error } = await client
    .from("event_listing_artists")
    .select("event_id, name, display_order")
    .in("event_id", eventIds)
    .order("display_order", { ascending: true });
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const list = map.get(row.event_id) ?? [];
    list.push(row.name);
    map.set(row.event_id, list);
  }
  return map;
}

export async function listPublicEvents(
  client: Client,
  options: {
    venueId?: string;
    fromIso?: string | null;
    toIso?: string | null;
    limit?: number;
    upcomingByEnd?: boolean;
    overlap?: boolean;
    exclusiveEnd?: boolean;
  } = {},
): Promise<{ events: PublicEventJson[]; error: string | null }> {
  const venueId = options.venueId ?? FLO_BAMA_VENUE_ID;
  let query = client
    .from("event_listings")
    .select("*")
    .eq("venue_id", venueId)
    .order("starts_at", { ascending: true })
    .limit(options.limit ?? 80);

  if (options.exclusiveEnd && options.fromIso && options.toIso) {
    query = query.gte("starts_at", options.fromIso).lt("starts_at", options.toIso);
  } else if (options.overlap && options.fromIso && options.toIso) {
    query = query.lt("starts_at", options.toIso).gt("ends_at", options.fromIso);
  } else {
    if (options.fromIso) {
      query =
        options.upcomingByEnd === false ? query.gte("starts_at", options.fromIso) : query.gte("ends_at", options.fromIso);
    }
    if (options.toIso) {
      query = query.lte("starts_at", options.toIso);
    }
  }

  const { data, error } = await query;
  if (error) return { events: [], error: error.message };
  const rows = data ?? [];
  const artists = await artistsByEvent(
    client,
    rows.map((row) => row.id),
  );
  return {
    error: null,
    events: rows
      .map((row) => toPublicEventJson(listingToStaff(row, artists.get(row.id) ?? [])))
      .filter((row): row is PublicEventJson => row !== null),
  };
}

export async function listPublicWeekEvents(
  client: Client,
  venueId = FLO_BAMA_VENUE_ID,
  now: Date = new Date(),
  timeZone = DEFAULT_VENUE_TIMEZONE,
): Promise<{ events: PublicEventJson[]; error: string | null }> {
  const { start, end } = venueWeekBounds(now, timeZone);
  const startIso = start.toUTC().toISO();
  const endIso = end.toUTC().toISO();
  return listPublicEvents(client, {
    venueId,
    fromIso: startIso,
    toIso: endIso,
    limit: 80,
    upcomingByEnd: false,
    exclusiveEnd: true,
  });
}

export async function getPublicEvent(
  client: Client,
  id: string,
  venueId = FLO_BAMA_VENUE_ID,
): Promise<{ event: PublicEventJson | null; error: string | null }> {
  const { data, error } = await client.from("event_listings").select("*").eq("id", id).eq("venue_id", venueId).maybeSingle();
  if (error) return { event: null, error: error.message };
  if (!data) return { event: null, error: null };
  const artists = await artistsByEvent(client, [data.id]);
  return { event: toPublicEventJson(listingToStaff(data, artists.get(data.id) ?? [])), error: null };
}

export async function getPublicNow(
  client: Client,
  venueId = FLO_BAMA_VENUE_ID,
  now: Date = new Date(),
  timeZone = DEFAULT_VENUE_TIMEZONE,
): Promise<{
  today: PublicEventJson[];
  nowPlaying: PublicEventJson | null;
  next: PublicEventJson | null;
  lowerThirdVisible: boolean;
  error: string | null;
}> {
  const { start, end } = venueDayBounds(now, timeZone);
  const startIso = start.toUTC().toISO();
  const endIso = end.toUTC().toISO();
  const nowIso = DateTimeUtc(now);

  const [todayRes, boothRes] = await Promise.all([
    client
      .from("event_listings")
      .select("*")
      .eq("venue_id", venueId)
      .lt("starts_at", endIso ?? "")
      .gt("ends_at", startIso ?? "")
      .order("starts_at", { ascending: true }),
    client.rpc("get_public_booth_now", { p_venue_id: venueId }),
  ]);

  if (todayRes.error) {
    return { today: [], nowPlaying: null, next: null, lowerThirdVisible: false, error: todayRes.error.message };
  }
  if (boothRes.error) {
    return { today: [], nowPlaying: null, next: null, lowerThirdVisible: false, error: boothRes.error.message };
  }

  const rows = todayRes.data ?? [];
  const artists = await artistsByEvent(
    client,
    rows.map((row) => row.id),
  );
  const today = rows
    .map((row) => toPublicEventJson(listingToStaff(row, artists.get(row.id) ?? [])))
    .filter((row): row is PublicEventJson => row !== null);

  const booth = Array.isArray(boothRes.data) ? boothRes.data[0] : boothRes.data;
  const liveId = booth?.live_event_id ?? null;
  let nowPlaying = liveId ? (today.find((event) => event.id === liveId) ?? null) : null;
  if (liveId && !nowPlaying) {
    const fetched = await getPublicEvent(client, liveId, venueId);
    if (fetched.error) {
      return { today, nowPlaying: null, next: null, lowerThirdVisible: false, error: fetched.error };
    }
    nowPlaying = fetched.event;
  }

  const upcoming = today.filter((event) => event.startsAt > nowIso);
  const happening = today.filter((event) => event.startsAt <= nowIso && event.endsAt > nowIso);
  const next =
    upcoming.find((event) => event.id !== nowPlaying?.id) ??
    happening.find((event) => event.id !== nowPlaying?.id) ??
    null;

  return {
    today,
    nowPlaying,
    next,
    lowerThirdVisible: Boolean(booth?.lower_third_visible),
    error: null,
  };
}

function DateTimeUtc(now: Date): string {
  return now.toISOString();
}
