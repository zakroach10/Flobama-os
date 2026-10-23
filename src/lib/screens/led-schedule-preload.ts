import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { DEFAULT_VENUE_TIMEZONE } from "@/lib/constants";
import { listTodayLedListings, type TodayLedListing } from "@/lib/queries/artist-led";

type Client = SupabaseClient<Database>;

/**
 * Scene ids for enabled artist LED graphics tied to today's schedule.
 * Used to warm the Local Runner cache before auto-roll or Server Station cuts.
 */
export function scheduledLedWarmupSceneIds(listings: TodayLedListing[]): string[] {
  const ids = new Set<string>();
  for (const listing of listings) {
    for (const artist of listing.artists) {
      if (artist.sceneId) ids.add(artist.sceneId);
    }
  }
  return [...ids];
}

/** Merge warmup ids into the active asset list without duplicates (stable order). */
export function mergeLedWarmupAssetIds(activeIds: string[], warmupIds: string[]): string[] {
  const seen = new Set(activeIds);
  const merged = [...activeIds];
  for (const id of warmupIds) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push(id);
  }
  return merged;
}

/**
 * Today's scheduled artist LED scenes for a venue.
 * Best-effort: missing artist-LED columns or event errors yield an empty list.
 */
export async function listScheduledLedWarmupSceneIds(
  client: Client,
  venueId: string,
  timeZone = DEFAULT_VENUE_TIMEZONE,
  now: Date = new Date(),
) {
  const { listings, missingColumn, error } = await listTodayLedListings(client, venueId, timeZone, now);
  if (missingColumn || error) return [] as string[];
  return scheduledLedWarmupSceneIds(listings);
}
