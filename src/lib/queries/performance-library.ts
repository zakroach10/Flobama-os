import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { isMissingDisplayDeviceRelation } from "@/lib/display-devices/status";

type Client = SupabaseClient<Database>;

// Note: newer display/performance tables currently live under Database.public.Views in
// database.types.ts (same placement as display_devices). Row shape is still authoritative.
export type StaffPerformanceRecording = Database["public"]["Views"]["performance_recordings"]["Row"] & {
  events?: { id: string; title: string; starts_at: string; ends_at: string; status: string } | null;
};

function missingPerf(message: string) {
  return /performance_recordings|performance_library|performance_commands|performance_playback/i.test(message);
}

export async function listStaffPerformanceRecordings(
  client: Client,
  venueId: string,
  filters?: {
    query?: string;
    matchStatus?: string;
    availability?: string;
    limit?: number;
  },
) {
  // Avoid embed joins here — a missing FK relationship made the whole list return empty.
  let q = client
    .from("performance_recordings")
    .select("*")
    .eq("venue_id", venueId)
    .neq("availability", "missing")
    .order("parsed_timestamp", { ascending: false })
    .limit(filters?.limit ?? 500);

  if (filters?.matchStatus && filters.matchStatus !== "all") {
    q = q.eq("match_status", filters.matchStatus as "matched" | "needs_review" | "unmatched" | "manual");
  }
  if (filters?.availability && filters.availability !== "all") {
    q = q.eq(
      "availability",
      filters.availability as
        | "metadata-only"
        | "needs download"
        | "preparing"
        | "ready"
        | "unsupported"
        | "missing"
        | "error",
    );
  }
  if (filters?.query) {
    const term = `%${filters.query}%`;
    q = q.or(
      `display_title.ilike.${term},original_filename.ilike.${term},relative_path.ilike.${term}`,
    );
  }

  const { data, error } = await q;
  if (error) {
    return {
      recordings: [] as StaffPerformanceRecording[],
      missingTable: missingPerf(error.message) || isMissingDisplayDeviceRelation(error.message),
      error: error.message,
    };
  }
  return {
    recordings: (data ?? []) as unknown as StaffPerformanceRecording[],
    missingTable: false,
    error: null as string | null,
  };
}

export async function getPerformanceLibrarySettings(client: Client, venueId: string) {
  const { data, error } = await client
    .from("performance_library_settings")
    .select("*")
    .eq("venue_id", venueId)
    .maybeSingle();
  if (error) {
    return {
      settings: null,
      missingTable: missingPerf(error.message),
      error: error.message,
    };
  }
  return { settings: data, missingTable: false, error: null as string | null };
}

export async function getPerformancePlaybackState(client: Client, deviceId: string) {
  const { data, error } = await client
    .from("performance_playback_state")
    .select("*")
    .eq("device_id", deviceId)
    .maybeSingle();
  if (error) {
    return { state: null, missingTable: missingPerf(error.message), error: error.message };
  }
  return { state: data, missingTable: false, error: null as string | null };
}

export async function listPerformanceQueue(client: Client, deviceId: string) {
  const { data, error } = await client
    .from("performance_queue_items")
    .select("*")
    .eq("device_id", deviceId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    return { items: [], missingTable: missingPerf(error.message), error: error.message };
  }
  return { items: data ?? [], missingTable: false, error: null as string | null };
}

export type PublishedStationPerformance = {
  id: string;
  recording_id: string;
  title: string;
  catalog_title: string | null;
  original_filename: string;
  availability: StaffPerformanceRecording["availability"];
  parsed_timestamp: string | null;
  duration_seconds: number | null;
  camera_count: number;
  server_station_title: string | null;
  server_station_sort_order: number;
};

/** Curated sessions published for Server Station floor staff. */
export async function listPublishedStationPerformances(client: Client, venueId: string) {
  const { data, error } = await client
    .from("performance_recordings")
    .select(
      "id, recording_id, display_title, server_station_title, original_filename, availability, parsed_timestamp, duration_seconds, camera_count, server_station_sort_order",
    )
    .eq("venue_id", venueId)
    .eq("server_station_published", true)
    .neq("availability", "missing")
    .order("server_station_sort_order", { ascending: true })
    .order("parsed_timestamp", { ascending: false })
    .limit(200);

  if (error) {
    return {
      performances: [] as PublishedStationPerformance[],
      missingTable:
        missingPerf(error.message) ||
        /server_station_published|server_station_title/i.test(error.message),
      error: error.message,
    };
  }

  const performances: PublishedStationPerformance[] = (data ?? []).map((row) => {
    const catalogTitle = row.display_title;
    const stationTitle = row.server_station_title?.trim() || null;
    return {
      id: row.id,
      recording_id: row.recording_id,
      title: stationTitle || catalogTitle || row.original_filename,
      catalog_title: catalogTitle,
      original_filename: row.original_filename,
      availability: row.availability,
      parsed_timestamp: row.parsed_timestamp,
      duration_seconds: row.duration_seconds,
      camera_count: row.camera_count ?? 0,
      server_station_title: stationTitle,
      server_station_sort_order: row.server_station_sort_order ?? 0,
    };
  });

  return { performances, missingTable: false, error: null as string | null };
}

export function stationPerformanceLabel(row: {
  server_station_title?: string | null;
  display_title?: string | null;
  original_filename: string;
}) {
  return (
    row.server_station_title?.trim() ||
    row.display_title?.trim() ||
    row.original_filename
  );
}
