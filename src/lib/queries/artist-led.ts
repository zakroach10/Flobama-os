import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { artistNames, type EventRow } from "@/lib/queries/events";
import { todayOverlapFilter } from "@/lib/queries/filters";
import type { LedWallSceneRow } from "@/lib/queries/led-wall";
import { pickDefaultArtistScene } from "@/lib/screens/artist-led";

type Client = SupabaseClient<Database>;

export type ArtistLedSceneSummary = {
  sceneId: string;
  title: string;
  publicUrl: string | null;
  mediaKind: "image" | "video" | "week_events" | "youtube" | null;
  enabled: boolean;
  isDefault: boolean;
};

export type ArtistLedConfig = {
  artistId: string;
  artistName: string;
  scenes: ArtistLedSceneSummary[];
  /** Default enabled scene (or first enabled). */
  defaultSceneId: string | null;
  publicUrl: string | null;
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
    scenes: ArtistLedSceneSummary[];
    defaultSceneId: string | null;
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
  return /artist_id|default_playlist_id|activation_source|auto_event_id|is_default/i.test(message)
    && /does not exist|schema cache|could not find/i.test(message);
}

export async function listArtistLedScenes(client: Client, venueId: string, artistId: string) {
  const withDefault = await client
    .from("led_wall_scenes")
    .select("*")
    .eq("venue_id", venueId)
    .eq("artist_id", artistId)
    .order("is_default", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });

  if (withDefault.error && /is_default/i.test(withDefault.error.message)) {
    const legacy = await client
      .from("led_wall_scenes")
      .select("*")
      .eq("venue_id", venueId)
      .eq("artist_id", artistId)
      .order("sort_order", { ascending: true });
    if (legacy.error) {
      return {
        scenes: [] as LedWallSceneRow[],
        missingColumn: isMissingArtistLedColumn(legacy.error.message),
        error: legacy.error.message,
      };
    }
    return {
      scenes: (legacy.data ?? []) as LedWallSceneRow[],
      missingColumn: false,
      error: null,
    };
  }

  if (withDefault.error) {
    return {
      scenes: [] as LedWallSceneRow[],
      missingColumn: isMissingArtistLedColumn(withDefault.error.message),
      error: withDefault.error.message,
    };
  }

  return {
    scenes: (withDefault.data ?? []) as LedWallSceneRow[],
    missingColumn: false,
    error: null,
  };
}

/** @deprecated Prefer listArtistLedScenes — kept for pages that still expect one row. */
export async function getArtistLedScene(client: Client, venueId: string, artistId: string) {
  const listed = await listArtistLedScenes(client, venueId, artistId);
  if (listed.error) {
    return {
      scene: null as LedWallSceneRow | null,
      missingColumn: listed.missingColumn,
      error: listed.error,
    };
  }
  const preferred =
    pickDefaultArtistScene(
      listed.scenes.map((scene) => ({
        ...scene,
        is_default: Boolean((scene as LedWallSceneRow & { is_default?: boolean }).is_default),
      })),
    ) ?? listed.scenes[0] ?? null;
  return { scene: preferred, missingColumn: false, error: null };
}

function summarizeScene(row: {
  id: string;
  title: string;
  public_url: string | null;
  media_kind: ArtistLedSceneSummary["mediaKind"];
  enabled: boolean;
  is_default?: boolean | null;
}): ArtistLedSceneSummary {
  return {
    sceneId: row.id,
    title: row.title,
    publicUrl: row.public_url,
    mediaKind: row.media_kind,
    enabled: row.enabled,
    isDefault: Boolean(row.is_default),
  };
}

export async function listArtistLedConfigs(client: Client, venueId: string) {
  const withDefault = await client
    .from("led_wall_scenes")
    .select("id, title, public_url, media_kind, enabled, artist_id, is_default, sort_order")
    .eq("venue_id", venueId)
    .not("artist_id", "is", null);

  let scenes = withDefault.data;
  let error = withDefault.error;

  if (error && /is_default/i.test(error.message)) {
    const legacy = await client
      .from("led_wall_scenes")
      .select("id, title, public_url, media_kind, enabled, artist_id, sort_order")
      .eq("venue_id", venueId)
      .not("artist_id", "is", null);
    scenes = (legacy.data ?? []).map((row) => ({ ...row, is_default: true }));
    error = legacy.error;
  }

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
  const byArtist = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!nameById.has(row.artist_id!)) continue;
    const list = byArtist.get(row.artist_id!) ?? [];
    list.push(row);
    byArtist.set(row.artist_id!, list);
  }

  const configs: ArtistLedConfig[] = [...byArtist.entries()]
    .map(([artistId, artistScenes]) => {
      const summaries = artistScenes.map((row) =>
        summarizeScene({
          id: row.id,
          title: row.title,
          public_url: row.public_url,
          media_kind: row.media_kind,
          enabled: row.enabled,
          is_default: (row as { is_default?: boolean }).is_default,
        }),
      );
      const defaultScene = pickDefaultArtistScene(
        summaries.map((scene) => ({
          id: scene.sceneId,
          enabled: scene.enabled,
          is_default: scene.isDefault,
          title: scene.title,
        })),
      );
      const defaultSummary = summaries.find((scene) => scene.sceneId === defaultScene?.id) ?? null;
      return {
        artistId,
        artistName: nameById.get(artistId)!,
        scenes: summaries,
        defaultSceneId: defaultSummary?.sceneId ?? null,
        publicUrl: defaultSummary?.publicUrl ?? null,
        enabled: summaries.some((scene) => scene.enabled),
      };
    })
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
        const enabledScenes = (config?.scenes ?? []).filter((scene) => scene.enabled);
        const defaultSceneId = config?.defaultSceneId ?? null;
        const defaultScene = enabledScenes.find((scene) => scene.sceneId === defaultSceneId) ?? enabledScenes[0] ?? null;
        return {
          artistId: row.artist_id,
          name: row.artists?.name ?? "Artist",
          displayOrder: row.display_order,
          scenes: enabledScenes,
          defaultSceneId: defaultScene?.sceneId ?? null,
          sceneId: defaultScene?.sceneId ?? null,
          publicUrl: defaultScene?.publicUrl ?? null,
          enabled: enabledScenes.length > 0,
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
