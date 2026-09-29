import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import {
  isMissingDisplaySignalRelation,
  normalizeReloadNonce,
  type DisplayReloadSignal,
} from "@/lib/screens/display-signals";

type Client = SupabaseClient<Database>;

export async function getPublicDisplayReloadSignal(
  client: Client,
  venueId = FLO_BAMA_VENUE_ID,
): Promise<{ signal: DisplayReloadSignal; error: string | null }> {
  const { data, error } = await client
    .from("screen_display_signal_listings")
    .select("reload_nonce, reload_requested_at")
    .eq("venue_id", venueId)
    .maybeSingle();
  if (error) {
    if (isMissingDisplaySignalRelation(error.message)) {
      return { signal: { reloadNonce: 1, reloadRequestedAt: null }, error: null };
    }
    return { signal: { reloadNonce: 1, reloadRequestedAt: null }, error: error.message };
  }
  return {
    signal: {
      reloadNonce: normalizeReloadNonce(data?.reload_nonce ?? 1),
      reloadRequestedAt: data?.reload_requested_at ?? null,
    },
    error: null,
  };
}

export async function getStaffDisplayReloadSignal(client: Client, venueId: string) {
  const { data, error } = await client
    .from("screen_display_signals")
    .select("reload_nonce, reload_requested_at")
    .eq("venue_id", venueId)
    .maybeSingle();
  if (error) {
    return {
      signal: null as DisplayReloadSignal | null,
      missingTable: isMissingDisplaySignalRelation(error.message),
      error: isMissingDisplaySignalRelation(error.message) ? null : error.message,
    };
  }
  return {
    signal: {
      reloadNonce: normalizeReloadNonce(data?.reload_nonce ?? 1),
      reloadRequestedAt: data?.reload_requested_at ?? null,
    },
    missingTable: false,
    error: null,
  };
}
