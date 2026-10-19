import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type {
  ProductionCommand,
  ProductionDeviceStatus,
  ProductionMarker,
  ProductionRecordingEvent,
  ProductionSession,
  ProductionSettings,
} from "@/lib/production/types";
import { liveSnapshotFromStatus } from "@/lib/production/status";
import type { EcammLiveSnapshot } from "@/lib/production/types";

type Client = SupabaseClient<Database>;

function missingProduction(message: string) {
  return /production_settings|production_device_status|production_sessions|production_markers|production_commands|production_recording_events|production_audit/i.test(
    message,
  );
}

export async function getProductionSettings(client: Client, venueId: string) {
  const { data, error } = await client
    .from("production_settings")
    .select("*")
    .eq("venue_id", venueId)
    .maybeSingle();
  if (error) {
    return {
      settings: null as ProductionSettings | null,
      missingTable: missingProduction(error.message),
      error: error.message,
    };
  }
  return {
    settings: (data as ProductionSettings | null) ?? null,
    missingTable: false,
    error: null as string | null,
  };
}

export async function getProductionDeviceStatus(client: Client, deviceId: string) {
  const { data, error } = await client
    .from("production_device_status")
    .select("*")
    .eq("device_id", deviceId)
    .maybeSingle();
  if (error) {
    return {
      status: null as ProductionDeviceStatus | null,
      live: null as EcammLiveSnapshot | null,
      missingTable: missingProduction(error.message),
      error: error.message,
    };
  }
  const status = (data as ProductionDeviceStatus | null) ?? null;
  return {
    status,
    live: status ? (liveSnapshotFromStatus(status.endpoint_status) as EcammLiveSnapshot | null) : null,
    missingTable: false,
    error: null as string | null,
  };
}

export async function getVenueProductionDeviceStatus(client: Client, venueId: string) {
  const { data, error } = await client
    .from("production_device_status")
    .select("*")
    .eq("venue_id", venueId)
    .order("reported_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    return {
      status: null as ProductionDeviceStatus | null,
      live: null as EcammLiveSnapshot | null,
      missingTable: missingProduction(error.message),
      error: error.message,
    };
  }
  const status = (data as ProductionDeviceStatus | null) ?? null;
  return {
    status,
    live: status ? (liveSnapshotFromStatus(status.endpoint_status) as EcammLiveSnapshot | null) : null,
    missingTable: false,
    error: null as string | null,
  };
}

export async function listProductionSessions(
  client: Client,
  venueId: string,
  options?: { limit?: number; eventId?: string | null },
) {
  let q = client
    .from("production_sessions")
    .select("*")
    .eq("venue_id", venueId)
    .order("started_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 40);
  if (options?.eventId) q = q.eq("event_id", options.eventId);

  const { data, error } = await q;
  if (error) {
    return {
      sessions: [] as ProductionSession[],
      missingTable: missingProduction(error.message),
      error: error.message,
    };
  }
  return {
    sessions: (data ?? []) as unknown as ProductionSession[],
    missingTable: false,
    error: null as string | null,
  };
}

export async function listProductionMarkers(
  client: Client,
  venueId: string,
  options?: { sessionId?: string | null; limit?: number },
) {
  let q = client
    .from("production_markers")
    .select("*")
    .eq("venue_id", venueId)
    .order("marked_at", { ascending: false })
    .limit(options?.limit ?? 80);
  if (options?.sessionId) q = q.eq("session_id", options.sessionId);

  const { data, error } = await q;
  if (error) {
    return {
      markers: [] as ProductionMarker[],
      missingTable: missingProduction(error.message),
      error: error.message,
    };
  }
  return {
    markers: (data ?? []) as unknown as ProductionMarker[],
    missingTable: false,
    error: null as string | null,
  };
}

export async function listRecentProductionCommands(
  client: Client,
  venueId: string,
  options?: { limit?: number; deviceId?: string | null },
) {
  let q = client
    .from("production_commands")
    .select("*")
    .eq("venue_id", venueId)
    .order("issued_at", { ascending: false })
    .limit(options?.limit ?? 30);
  if (options?.deviceId) q = q.eq("device_id", options.deviceId);

  const { data, error } = await q;
  if (error) {
    return {
      commands: [] as ProductionCommand[],
      missingTable: missingProduction(error.message),
      error: error.message,
    };
  }
  return {
    commands: (data ?? []) as unknown as ProductionCommand[],
    missingTable: false,
    error: null as string | null,
  };
}

export async function listProductionRecordingEvents(
  client: Client,
  venueId: string,
  options?: { limit?: number },
) {
  const { data, error } = await client
    .from("production_recording_events")
    .select("*")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 40);
  if (error) {
    return {
      events: [] as ProductionRecordingEvent[],
      missingTable: missingProduction(error.message),
      error: error.message,
    };
  }
  return {
    events: (data ?? []) as unknown as ProductionRecordingEvent[],
    missingTable: false,
    error: null as string | null,
  };
}

export type ProductionPageEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: string;
  event_artists?: Array<{ artists: { id: string; name: string } | null }> | null;
};

/** Upcoming + recent events for Production event picker (America/Chicago venue day). */
export async function listProductionRelevantEvents(client: Client, venueId: string, now = new Date()) {
  const windowStart = new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await client
    .from("events")
    .select("id, title, starts_at, ends_at, status, event_artists(artists(id, name))")
    .eq("venue_id", venueId)
    .is("archived_at", null)
    .gte("ends_at", windowStart)
    .lte("starts_at", windowEnd)
    .neq("status", "cancelled")
    .order("starts_at", { ascending: true })
    .limit(80);

  if (error) {
    return { events: [] as ProductionPageEvent[], error: error.message };
  }
  return { events: (data ?? []) as unknown as ProductionPageEvent[], error: null as string | null };
}
