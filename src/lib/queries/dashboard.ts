import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { artistNames, type EventRow } from "@/lib/queries/events";
import { todayOverlapFilter } from "@/lib/queries/filters";

type Client = SupabaseClient<Database>;

const EVENT_SELECT = `
  *,
  event_artists (
    artist_id,
    display_order,
    artists ( id, name, archived_at, led_wall_scene_id )
  )
`;

export type DashboardData = {
  today: EventRow[];
  nextSevenCount: number;
  upcomingDraftCount: number;
  activeArtistCount: number;
  draftEvents: EventRow[];
  liveMusicMissingArtists: EventRow[];
  upcoming: EventRow[];
};

export async function loadDashboard(
  client: Client,
  venueId: string,
  timeZone: string,
  now: Date = new Date(),
): Promise<{ data: DashboardData | null; error: string | null }> {
  const nowIso = now.toISOString();
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { startIso, endIso } = todayOverlapFilter(now, timeZone);

  const [todayRes, nextSevenRes, draftCountRes, artistCountRes, draftListRes, liveMissingRes, upcomingRes] =
    await Promise.all([
      client
        .from("events")
        .select(EVENT_SELECT)
        .eq("venue_id", venueId)
        .is("archived_at", null)
        .lt("starts_at", endIso)
        .gt("ends_at", startIso)
        .order("starts_at", { ascending: true }),
      client
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("venue_id", venueId)
        .is("archived_at", null)
        .neq("status", "cancelled")
        .gte("starts_at", nowIso)
        .lt("starts_at", weekEnd),
      client
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("venue_id", venueId)
        .is("archived_at", null)
        .eq("status", "draft")
        .gte("ends_at", nowIso),
      client
        .from("artists")
        .select("id", { count: "exact", head: true })
        .eq("venue_id", venueId)
        .is("archived_at", null),
      client
        .from("events")
        .select(EVENT_SELECT)
        .eq("venue_id", venueId)
        .is("archived_at", null)
        .eq("status", "draft")
        .gte("ends_at", nowIso)
        .order("starts_at", { ascending: true })
        .limit(8),
      client
        .from("events")
        .select(EVENT_SELECT)
        .eq("venue_id", venueId)
        .is("archived_at", null)
        .eq("event_type", "live_music")
        .neq("status", "cancelled")
        .gte("ends_at", nowIso)
        .order("starts_at", { ascending: true })
        .limit(20),
      client
        .from("events")
        .select(EVENT_SELECT)
        .eq("venue_id", venueId)
        .is("archived_at", null)
        .neq("status", "cancelled")
        .gte("ends_at", nowIso)
        .order("starts_at", { ascending: true })
        .limit(6),
    ]);

  const firstError =
    todayRes.error?.message ||
    nextSevenRes.error?.message ||
    draftCountRes.error?.message ||
    artistCountRes.error?.message ||
    draftListRes.error?.message ||
    liveMissingRes.error?.message ||
    upcomingRes.error?.message;

  if (firstError) {
    return { data: null, error: firstError };
  }

  const liveMusic = (liveMissingRes.data ?? []) as unknown as EventRow[];
  const liveMusicMissingArtists = liveMusic.filter((event) => artistNames(event).length === 0);

  return {
    error: null,
    data: {
      today: (todayRes.data ?? []) as unknown as EventRow[],
      nextSevenCount: nextSevenRes.count ?? 0,
      upcomingDraftCount: draftCountRes.count ?? 0,
      activeArtistCount: artistCountRes.count ?? 0,
      draftEvents: (draftListRes.data ?? []) as unknown as EventRow[],
      liveMusicMissingArtists,
      upcoming: (upcomingRes.data ?? []) as unknown as EventRow[],
    },
  };
}
