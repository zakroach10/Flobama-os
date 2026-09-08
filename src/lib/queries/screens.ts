import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { toPublicPlaylist, type PublicScreenAd, type StaffScreenAd } from "@/lib/screens/playlist";
import {
  isMissingScreenTakeoverRelation,
  isTakeoverActive,
  type PublicTakeover,
  type StaffTakeover,
} from "@/lib/screens/takeover";

type Client = SupabaseClient<Database>;

export type WallStateRow = Database["public"]["Tables"]["screen_wall_state"]["Row"];

export async function getScreenWallState(client: Client, venueId: string) {
  const { data, error } = await client.from("screen_wall_state").select("*").eq("venue_id", venueId).maybeSingle();
  if (error) return { wall: null as WallStateRow | null, error: error.message };
  return { wall: data, error: null };
}

export async function listStaffScreenAds(client: Client, venueId: string) {
  const { data, error } = await client
    .from("screen_ads")
    .select("*")
    .eq("venue_id", venueId)
    .is("archived_at", null)
    .order("sort_order", { ascending: true });
  if (error) return { ads: [] as StaffScreenAd[], error: error.message };
  return { ads: (data ?? []) as StaffScreenAd[], error: null };
}

export async function listPublicVerticalAds(
  client: Client,
  venueId = FLO_BAMA_VENUE_ID,
): Promise<{ ads: PublicScreenAd[]; error: string | null }> {
  const { data, error } = await client
    .from("screen_ad_listings")
    .select("*")
    .eq("venue_id", venueId)
    .order("sort_order", { ascending: true });
  if (error) return { ads: [], error: error.message };
  const ads = toPublicPlaylist(
    (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      public_url: row.public_url,
      media_kind: row.media_kind,
      duration_seconds: row.duration_seconds,
      transition: row.transition,
      sort_order: row.sort_order,
      enabled: true,
      archived_at: null,
    })),
  );
  return { ads, error: null };
}

export async function getStaffTakeover(client: Client, venueId: string) {
  const { data, error } = await client
    .from("screen_takeovers")
    .select("ad_id, ends_at")
    .eq("venue_id", venueId)
    .maybeSingle();
  if (error) {
    return {
      takeover: null as StaffTakeover | null,
      missingTable: isMissingScreenTakeoverRelation(error.message),
      error: error.message,
    };
  }
  if (!data || !isTakeoverActive(data.ends_at)) {
    return { takeover: null as StaffTakeover | null, missingTable: false, error: null };
  }
  const { data: ad } = await client
    .from("screen_ads")
    .select("title, archived_at")
    .eq("id", data.ad_id)
    .eq("venue_id", venueId)
    .maybeSingle();
  if (!ad || ad.archived_at) {
    return { takeover: null as StaffTakeover | null, missingTable: false, error: null };
  }
  return {
    takeover: {
      adId: data.ad_id,
      title: ad.title,
      endsAt: data.ends_at,
    } satisfies StaffTakeover,
    missingTable: false,
    error: null,
  };
}

export async function getPublicTakeover(
  client: Client,
  venueId = FLO_BAMA_VENUE_ID,
): Promise<{ takeover: PublicTakeover | null; error: string | null }> {
  const { data, error } = await client.from("screen_takeover_listings").select("*").eq("venue_id", venueId).maybeSingle();
  if (error) {
    if (isMissingScreenTakeoverRelation(error.message)) return { takeover: null, error: null };
    return { takeover: null, error: error.message };
  }
  if (!data || !isTakeoverActive(data.ends_at)) return { takeover: null, error: null };
  return {
    takeover: {
      ad: {
        id: data.ad_id,
        title: data.title,
        url: data.public_url,
        mediaKind: data.media_kind,
        durationSeconds: data.duration_seconds,
        transition: data.transition,
      },
      endsAt: data.ends_at,
    },
    error: null,
  };
}
