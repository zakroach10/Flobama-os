import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { artistNames, type EventRow } from "@/lib/queries/events";
import { todayOverlapFilter } from "@/lib/queries/filters";
import { listArtistLedConfigs } from "@/lib/queries/artist-led";
import { venueWeekBounds } from "@/lib/timezone";

type Client = SupabaseClient<Database>;

const EVENT_SELECT = `
  *,
  event_artists (
    artist_id,
    display_order,
    artists ( id, name, archived_at )
  )
`;

/** How far ahead to scan for upcoming shows missing band logos. */
const MISSING_LOGO_LOOKAHEAD_DAYS = 60;
const MISSING_LOGO_EVENT_LIMIT = 80;

export type MissingLogoBucket = "this_week" | "upcoming";

export type MissingLogoArtist = {
  artistId: string;
  artistName: string;
  eventId: string;
  eventTitle: string;
  startsAt: string;
  bucket: MissingLogoBucket;
};

export type DashboardData = {
  today: EventRow[];
  nextSevenCount: number;
  upcomingDraftCount: number;
  activeArtistCount: number;
  draftEvents: EventRow[];
  liveMusicMissingArtists: EventRow[];
  upcoming: EventRow[];
  artistsMissingLogos: MissingLogoArtist[];
};

export function collectArtistsMissingLogos(
  events: EventRow[],
  artistsWithLogo: ReadonlySet<string>,
  weekEndIso: string,
): MissingLogoArtist[] {
  const byArtist = new Map<string, MissingLogoArtist>();

  for (const event of events) {
    const bucket: MissingLogoBucket = event.starts_at < weekEndIso ? "this_week" : "upcoming";
    const linked = [...event.event_artists].sort((a, b) => a.display_order - b.display_order);

    for (const row of linked) {
      const artist = row.artists;
      if (!artist || artist.archived_at) continue;
      if (artistsWithLogo.has(artist.id)) continue;

      const existing = byArtist.get(artist.id);
      if (existing && existing.startsAt <= event.starts_at) continue;

      byArtist.set(artist.id, {
        artistId: artist.id,
        artistName: artist.name,
        eventId: event.id,
        eventTitle: event.title,
        startsAt: event.starts_at,
        bucket,
      });
    }
  }

  return [...byArtist.values()].sort((a, b) => {
    if (a.bucket !== b.bucket) return a.bucket === "this_week" ? -1 : 1;
    return a.startsAt.localeCompare(b.startsAt) || a.artistName.localeCompare(b.artistName);
  });
}

export async function loadDashboard(
  client: Client,
  venueId: string,
  timeZone: string,
  now: Date = new Date(),
): Promise<{ data: DashboardData | null; error: string | null }> {
  const nowIso = now.toISOString();
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { startIso, endIso } = todayOverlapFilter(now, timeZone);
  const { start: weekStart, end: venueWeekEnd } = venueWeekBounds(now, timeZone);
  const weekStartIso = weekStart.toUTC().toISO()!;
  const venueWeekEndIso = venueWeekEnd.toUTC().toISO()!;
  const logoLookaheadEnd = new Date(
    now.getTime() + MISSING_LOGO_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [
    todayRes,
    nextSevenRes,
    draftCountRes,
    artistCountRes,
    draftListRes,
    liveMissingRes,
    upcomingRes,
    logoEventsRes,
    artistLedRes,
  ] = await Promise.all([
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
      client
        .from("events")
        .select(EVENT_SELECT)
        .eq("venue_id", venueId)
        .is("archived_at", null)
        .eq("event_type", "live_music")
        .neq("status", "cancelled")
        .gte("ends_at", nowIso)
        .gte("starts_at", weekStartIso)
        .lt("starts_at", logoLookaheadEnd)
        .order("starts_at", { ascending: true })
        .limit(MISSING_LOGO_EVENT_LIMIT),
      listArtistLedConfigs(client, venueId),
    ]);

  const firstError =
    todayRes.error?.message ||
    nextSevenRes.error?.message ||
    draftCountRes.error?.message ||
    artistCountRes.error?.message ||
    draftListRes.error?.message ||
    liveMissingRes.error?.message ||
    upcomingRes.error?.message ||
    logoEventsRes.error?.message ||
    (artistLedRes.error && !artistLedRes.missingColumn ? artistLedRes.error : null);

  if (firstError) {
    return { data: null, error: firstError };
  }

  const liveMusic = (liveMissingRes.data ?? []) as unknown as EventRow[];
  const liveMusicMissingArtists = liveMusic.filter((event) => artistNames(event).length === 0);

  const artistsWithLogo = new Set(
    artistLedRes.configs
      .filter((config) => Boolean(config.publicUrl))
      .map((config) => config.artistId),
  );
  const artistsMissingLogos = collectArtistsMissingLogos(
    (logoEventsRes.data ?? []) as unknown as EventRow[],
    artistsWithLogo,
    venueWeekEndIso,
  );

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
      artistsMissingLogos,
    },
  };
}
