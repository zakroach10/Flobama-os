import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { isMissingServerStationRelation } from "@/lib/auth/server-station";

export type ServerStationSettings = {
  venue_id: string;
  show_now_enabled: boolean;
  birthday_approval_required: boolean;
  temporary_playlist_id: string | null;
  default_slide_seconds: number;
  default_override_minutes: number;
  max_upload_bytes: number;
  business_night_end_hour: number;
  staff_idle_seconds: number;
};

export const DEFAULT_SERVER_STATION_SETTINGS: Omit<ServerStationSettings, "venue_id"> = {
  show_now_enabled: true,
  birthday_approval_required: false,
  temporary_playlist_id: null,
  default_slide_seconds: 12,
  default_override_minutes: 5,
  max_upload_bytes: 10 * 1024 * 1024,
  business_night_end_hour: 2,
  staff_idle_seconds: 180,
};

type Client = SupabaseClient<Database>;

export async function getServerStationSettings(client: Client, venueId: string) {
  const { data, error } = await client
    .from("server_station_settings")
    .select("*")
    .eq("venue_id", venueId)
    .maybeSingle();

  if (error) {
    return {
      settings: { venue_id: venueId, ...DEFAULT_SERVER_STATION_SETTINGS } satisfies ServerStationSettings,
      missingTable: isMissingServerStationRelation(error.message),
      error: isMissingServerStationRelation(error.message) ? null : error.message,
    };
  }

  if (!data) {
    return {
      settings: { venue_id: venueId, ...DEFAULT_SERVER_STATION_SETTINGS } satisfies ServerStationSettings,
      missingTable: false,
      error: null,
    };
  }

  return {
    settings: data as ServerStationSettings,
    missingTable: false,
    error: null,
  };
}
