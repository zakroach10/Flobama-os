import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { DEFAULT_VENUE_TIMEZONE, FLO_BAMA_VENUE_ID } from "@/lib/constants";
import {
  ARTIST_LED_AUTO_ROLL_MINUTES,
  canAutoReplaceLedWall,
  isWithinArtistLedAutoWindow,
  pickPrimaryArtistId,
  shouldRunAdRollReset,
  venueLocalDateString,
} from "@/lib/screens/artist-led";
import { endTriviaSession } from "@/lib/trivia/runtime";

type Client = SupabaseClient<Database>;

export type LedWallAutomationResult = {
  adRollReset: boolean;
  artistAutoActivated: Array<{ eventId: string; artistId: string; sceneId: string }>;
  skipped: string[];
};

const ARTIST_LED_LOOKAHEAD_MS = (ARTIST_LED_AUTO_ROLL_MINUTES + 1) * 60 * 1000;

async function loadVenueTimezone(client: Client, venueId: string) {
  const { data } = await client.from("venues").select("timezone").eq("id", venueId).maybeSingle();
  return data?.timezone?.trim() || DEFAULT_VENUE_TIMEZONE;
}

async function activeSceneKind(client: Client, sceneId: string | null | undefined) {
  if (!sceneId) return null;
  const { data } = await client.from("led_wall_scenes").select("kind").eq("id", sceneId).maybeSingle();
  return data?.kind ?? null;
}

function canAutoArtistCut(input: {
  activeKind: string | null;
  activationSource: string | null | undefined;
  activePlaylistId: string | null | undefined;
  defaultPlaylistId: string | null | undefined;
  activeSceneId: string | null | undefined;
}) {
  if (!canAutoReplaceLedWall(input.activeKind)) return false;
  if (!input.activeSceneId && !input.activePlaylistId) return true;
  if (input.activationSource === "ad_roll" || input.activationSource === "artist_auto") return true;
  if (input.activePlaylistId && input.activePlaylistId === input.defaultPlaylistId) return true;
  return false;
}

async function activateAdRoll(client: Client, venueId: string, playlistId: string, timeZone: string) {
  await endTriviaSession(client, venueId);
  const { error } = await client.from("led_wall_runtime").upsert(
    {
      venue_id: venueId,
      active_scene_id: null,
      active_playlist_id: playlistId,
      activation_source: "ad_roll",
      auto_event_id: null,
      auto_artist_id: null,
    },
    { onConflict: "venue_id" },
  );
  if (error) return error.message;

  const today = venueLocalDateString(new Date(), timeZone);
  const { data: existing } = await client
    .from("led_wall_settings")
    .select("venue_id")
    .eq("venue_id", venueId)
    .maybeSingle();
  if (existing) {
    await client.from("led_wall_settings").update({ last_ad_roll_reset_on: today }).eq("venue_id", venueId);
  } else {
    await client.from("led_wall_settings").insert({ venue_id: venueId, last_ad_roll_reset_on: today });
  }
  return null;
}

async function activateArtistScene(
  client: Client,
  venueId: string,
  input: { sceneId: string; eventId: string; artistId: string },
) {
  await endTriviaSession(client, venueId);
  const { error } = await client.from("led_wall_runtime").upsert(
    {
      venue_id: venueId,
      active_scene_id: input.sceneId,
      active_playlist_id: null,
      activation_source: "artist_auto",
      auto_event_id: input.eventId,
      auto_artist_id: input.artistId,
    },
    { onConflict: "venue_id" },
  );
  return error?.message ?? null;
}

export async function runLedWallAutomation(
  client: Client,
  venueId = FLO_BAMA_VENUE_ID,
  now: Date = new Date(),
): Promise<LedWallAutomationResult> {
  const result: LedWallAutomationResult = {
    adRollReset: false,
    artistAutoActivated: [],
    skipped: [],
  };

  const timeZone = await loadVenueTimezone(client, venueId);
  const [{ data: settings }, { data: runtime }] = await Promise.all([
    client
      .from("led_wall_settings")
      .select("default_playlist_id, last_ad_roll_reset_on")
      .eq("venue_id", venueId)
      .maybeSingle(),
    client
      .from("led_wall_runtime")
      .select("active_scene_id, active_playlist_id, activation_source, auto_event_id")
      .eq("venue_id", venueId)
      .maybeSingle(),
  ]);

  let activeKind = await activeSceneKind(client, runtime?.active_scene_id);

  if (
    shouldRunAdRollReset({
      now,
      timeZone,
      lastResetOn: settings?.last_ad_roll_reset_on ?? null,
    })
  ) {
    if (!settings?.default_playlist_id) {
      result.skipped.push("Ad-roll reset skipped — no default playlist set.");
    } else if (!canAutoReplaceLedWall(activeKind)) {
      result.skipped.push("Ad-roll reset skipped — trivia or audience is live.");
    } else {
      const err = await activateAdRoll(client, venueId, settings.default_playlist_id, timeZone);
      if (err) result.skipped.push(err);
      else {
        result.adRollReset = true;
        activeKind = null;
      }
    }
  }

  const { data: runtimeAfter } = await client
    .from("led_wall_runtime")
    .select("active_scene_id, active_playlist_id, activation_source, auto_event_id")
    .eq("venue_id", venueId)
    .maybeSingle();

  const windowStart = new Date(now.getTime() - 60_000).toISOString();
  const windowEnd = new Date(now.getTime() + ARTIST_LED_LOOKAHEAD_MS).toISOString();

  const { data: events, error: eventsError } = await client
    .from("events")
    .select(
      `
      id,
      starts_at,
      status,
      event_artists (
        artist_id,
        display_order
      )
    `,
    )
    .eq("venue_id", venueId)
    .is("archived_at", null)
    .eq("status", "published")
    .gte("starts_at", windowStart)
    .lte("starts_at", windowEnd)
    .order("starts_at", { ascending: true });

  if (eventsError) {
    result.skipped.push(eventsError.message);
    return result;
  }

  const { data: artistScenes } = await client
    .from("led_wall_scenes")
    .select("id, artist_id, enabled")
    .eq("venue_id", venueId)
    .eq("enabled", true)
    .not("artist_id", "is", null);

  const sceneByArtist = new Map(
    ((artistScenes ?? []) as Array<{ id: string; artist_id: string | null; enabled: boolean }>)
      .filter((row) => row.artist_id)
      .map((row) => [row.artist_id!, row.id]),
  );

  for (const event of events ?? []) {
    if (!isWithinArtistLedAutoWindow(event.starts_at, now)) continue;
    if (runtimeAfter?.auto_event_id === event.id && runtimeAfter.activation_source === "artist_auto") {
      continue;
    }
    if (
      !canAutoArtistCut({
        activeKind,
        activationSource: runtimeAfter?.activation_source,
        activePlaylistId: runtimeAfter?.active_playlist_id,
        defaultPlaylistId: settings?.default_playlist_id,
        activeSceneId: runtimeAfter?.active_scene_id,
      })
    ) {
      result.skipped.push(`Skipped auto for event ${event.id} — wall is on a manual selection.`);
      continue;
    }

    const artists = ((event.event_artists ?? []) as Array<{ artist_id: string; display_order: number }>).map(
      (row) => ({
        artist_id: row.artist_id,
        display_order: row.display_order,
        hasLedConfig: sceneByArtist.has(row.artist_id),
      }),
    );
    const artistId = pickPrimaryArtistId(artists);
    if (!artistId) {
      result.skipped.push(`Skipped auto for event ${event.id} — no artist LED config.`);
      continue;
    }
    const sceneId = sceneByArtist.get(artistId);
    if (!sceneId) continue;

    const err = await activateArtistScene(client, venueId, {
      sceneId,
      eventId: event.id,
      artistId,
    });
    if (err) {
      result.skipped.push(err);
      continue;
    }
    result.artistAutoActivated.push({ eventId: event.id, artistId, sceneId });
    break;
  }

  return result;
}
