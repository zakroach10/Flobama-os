import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { artistNames, type EventRow } from "@/lib/queries/events";
import { todayOverlapFilter } from "@/lib/queries/filters";
import type { LedWallSceneRow } from "@/lib/queries/led-wall";

type Client = SupabaseClient<Database>;

export type ArtistLedConfig = {
  artistId: string;
  artistName: string;
  sceneId: string;
  title: string;
  publicUrl: string | null;
  mediaKind: "image" | "video" | "week_events" | null;
  enabled: boolean;
};

export type TodayLedListing = {
  eventId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: EventRow["status"];
  artistNames: string[];
  artists: Array<{
    artistId: string;
    name: string;
    displayOrder: number;
    sceneId: string | null;
    publicUrl: string | null;
    enabled: boolean;
  }>;
};

const EVENT_SELECT = `
  *,
  event_artists (
    artist_id,
    display_order,
    artists ( id, name, archived_at )
  )
`;

function isMissingArtistLedColumn(message: string) {
  return /artist_id|default_playlist_id|activation_source|auto_event_id/i.test(message)
    && /does not exist|schema cache|could not find/i.test(message);
}

export async function getArtistLedScene(client: Client, venueId: string, artistId: string) {
  const { data, error } = await client
    .from("led_wall_scenes")
    .select("*")
    .eq("venue_id", venueId)
    .eq("artist_id", artistId)
    .maybeSingle();
  if (error) {
    return {
      scene: null as LedWallSceneRow | null,
      missingColumn: isMissingArtistLedColumn(error.message),
      error: error.message,
    };
  }
  return { scene: data as LedWallSceneRow | null, missingColumn: false, error: null };
}

export async function listArtistLedConfigs(client: Client, venueId: string) {
  const { data: scenes, error } = await client
    .from("led_wall_scenes")
    .select("id, title, public_url, media_kind, enabled, artist_id")
    .eq("venue_id", venueId)
    .not("artist_id", "is", null);

  if (error) {
    return {
      configs: [] as ArtistLedConfig[],
      missingColumn: isMissingArtistLedColumn(error.message),
      error: error.message,
    };
  }

  const rows = (scenes ?? []).filter((row) => row.artist_id);
  if (rows.length === 0) return { configs: [] as ArtistLedConfig[], missingColumn: false, error: null };

  const artistIds = [...new Set(rows.map((row) => row.artist_id!))];
  const { data: artists, error: artistsError } = await client
    .from("artists")
    .select("id, name, archived_at")
    .eq("venue_id", venueId)
    .in("id", artistIds)
    .is("archived_at", null);
  if (artistsError) {
    return { configs: [] as ArtistLedConfig[], missingColumn: false, error: artistsError.message };
  }

  const nameById = new Map((artists ?? []).map((artist) => [artist.id, artist.name]));
  const configs: ArtistLedConfig[] = rows
    .filter((row) => nameById.has(row.artist_id!))
    .map((row) => ({
      artistId: row.artist_id!,
      artistName: nameById.get(row.artist_id!)!,
      sceneId: row.id,
      title: row.title,
      publicUrl: row.public_url,
      mediaKind: row.media_kind,
      enabled: row.enabled,
    }))
    .sort((a, b) => a.artistName.localeCompare(b.artistName));

  return { configs, missingColumn: false, error: null };
}

export async function listTodayLedListings(
  client: Client,
  venueId: string,
  timeZone: string,
  now: Date = new Date(),
) {
  const { startIso, endIso } = todayOverlapFilter(now, timeZone);
  const [eventsRes, configsRes] = await Promise.all([
    client
      .from("events")
      .select(EVENT_SELECT)
      .eq("venue_id", venueId)
      .is("archived_at", null)
      .neq("status", "cancelled")
      .lt("starts_at", endIso)
      .gt("ends_at", startIso)
      .order("starts_at", { ascending: true }),
    listArtistLedConfigs(client, venueId),
  ]);

  if (eventsRes.error) {
    return {
      listings: [] as TodayLedListing[],
      missingColumn: configsRes.missingColumn,
      error: eventsRes.error.message,
    };
  }
  if (configsRes.error && !configsRes.missingColumn) {
    return { listings: [] as TodayLedListing[], missingColumn: false, error: configsRes.error };
  }

  const configByArtist = new Map(configsRes.configs.map((config) => [config.artistId, config]));
  const listings: TodayLedListing[] = ((eventsRes.data ?? []) as unknown as EventRow[]).map((event) => {
    const artists = [...event.event_artists]
      .sort((a, b) => a.display_order - b.display_order)
      .map((row) => {
        const config = configByArtist.get(row.artist_id);
        return {
          artistId: row.artist_id,
          name: row.artists?.name ?? "Artist",
          displayOrder: row.display_order,
          sceneId: config?.enabled ? config.sceneId : null,
          publicUrl: config?.enabled ? config.publicUrl : null,
          enabled: Boolean(config?.enabled),
        };
      });
    return {
      eventId: event.id,
      title: event.title,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      status: event.status,
      artistNames: artistNames(event),
      artists,
    };
  });

  return { listings, missingColumn: configsRes.missingColumn, error: null };
}
