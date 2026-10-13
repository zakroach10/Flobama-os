import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import {
  isMissingDisplaySignalRelation,
  normalizeReloadNonce,
  type DisplayReloadSignal,
} from "@/lib/screens/display-signals";

type Client = SupabaseClient<Database>;

function toSignal(row: {
  reload_nonce?: number | null;
  reload_requested_at?: string | null;
  hosted_led_public_enabled?: boolean | null;
  hosted_vertical_public_enabled?: boolean | null;
} | null): DisplayReloadSignal {
  return {
    reloadNonce: normalizeReloadNonce(row?.reload_nonce ?? 1),
    reloadRequestedAt: row?.reload_requested_at ?? null,
    // Missing columns / null → treat as enabled (pre-migration safe default).
    hostedLedPublicEnabled: row?.hosted_led_public_enabled !== false,
    hostedVerticalPublicEnabled: row?.hosted_vertical_public_enabled !== false,
  };
}

const defaultSignal = (): DisplayReloadSignal => ({
  reloadNonce: 1,
  reloadRequestedAt: null,
  hostedLedPublicEnabled: true,
  hostedVerticalPublicEnabled: true,
});

export async function getPublicDisplayReloadSignal(
  client: Client,
  venueId = FLO_BAMA_VENUE_ID,
): Promise<{ signal: DisplayReloadSignal; error: string | null }> {
  const { data, error } = await client
    .from("screen_display_signal_listings")
    .select(
      "reload_nonce, reload_requested_at, hosted_led_public_enabled, hosted_vertical_public_enabled",
    )
    .eq("venue_id", venueId)
    .maybeSingle();
  if (error) {
    if (isMissingDisplaySignalRelation(error.message)) {
      // Column missing before migration — retry without new fields.
      const legacy = await client
        .from("screen_display_signal_listings")
        .select("reload_nonce, reload_requested_at")
        .eq("venue_id", venueId)
        .maybeSingle();
      if (legacy.error) {
        if (isMissingDisplaySignalRelation(legacy.error.message)) {
          return { signal: defaultSignal(), error: null };
        }
        return { signal: defaultSignal(), error: legacy.error.message };
      }
      return { signal: toSignal(legacy.data), error: null };
    }
    return { signal: defaultSignal(), error: error.message };
  }
  return { signal: toSignal(data), error: null };
}

export async function getStaffDisplayReloadSignal(client: Client, venueId: string) {
  const { data, error } = await client
    .from("screen_display_signals")
    .select(
      "reload_nonce, reload_requested_at, hosted_led_public_enabled, hosted_vertical_public_enabled",
    )
    .eq("venue_id", venueId)
    .maybeSingle();
  if (error) {
    if (isMissingDisplaySignalRelation(error.message)) {
      const legacy = await client
        .from("screen_display_signals")
        .select("reload_nonce, reload_requested_at")
        .eq("venue_id", venueId)
        .maybeSingle();
      if (legacy.error) {
        return {
          signal: null as DisplayReloadSignal | null,
          missingTable: isMissingDisplaySignalRelation(legacy.error.message),
          error: isMissingDisplaySignalRelation(legacy.error.message) ? null : legacy.error.message,
        };
      }
      return {
        signal: toSignal(legacy.data),
        missingTable: false,
        error: null,
      };
    }
    return {
      signal: null as DisplayReloadSignal | null,
      missingTable: false,
      error: error.message,
    };
  }
  return {
    signal: toSignal(data),
    missingTable: false,
    error: null,
  };
}
