import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { isMissingServerStationRelation } from "@/lib/auth/server-station";
import { SERVER_STATION_UPLOAD_LIBRARY_SQL } from "@/lib/constants";

type Client = SupabaseClient<Database>;

export type ServerStationUploadLibraryItem = {
  id: string;
  title: string;
  publicUrl: string;
  storagePath: string;
  mediaKind: "image" | "video";
  contentHash: string | null;
  templateId: string;
  endsAt: string;
  lastSetOnWallAt: string | null;
  createdAt: string;
  createdByName: string | null;
};

function mapRow(row: {
  id: string;
  title: string;
  public_url: string;
  storage_path: string;
  media_kind: string;
  content_hash: string | null;
  template_id: string;
  ends_at: string;
  last_set_on_wall_at: string | null;
  created_at: string;
  created_by_name: string | null;
}): ServerStationUploadLibraryItem {
  return {
    id: row.id,
    title: row.title,
    publicUrl: row.public_url,
    storagePath: row.storage_path,
    mediaKind: row.media_kind === "video" ? "video" : "image",
    contentHash: row.content_hash,
    templateId: row.template_id,
    endsAt: row.ends_at,
    lastSetOnWallAt: row.last_set_on_wall_at,
    createdAt: row.created_at,
    createdByName: row.created_by_name,
  };
}

export function uploadLibraryMissingMessage(message?: string | null) {
  if (message && isMissingServerStationRelation(message)) {
    return `Apply ${SERVER_STATION_UPLOAD_LIBRARY_SQL} in the Supabase SQL editor, then try again.`;
  }
  if (message && /server_station_upload_library/i.test(message) && /does not exist|schema cache/i.test(message)) {
    return `Apply ${SERVER_STATION_UPLOAD_LIBRARY_SQL} in the Supabase SQL editor, then try again.`;
  }
  return message ?? `Apply ${SERVER_STATION_UPLOAD_LIBRARY_SQL} in the Supabase SQL editor, then try again.`;
}

export async function addUploadLibraryItem(
  client: Client,
  input: {
    venueId: string;
    title: string;
    publicUrl: string;
    storagePath: string;
    mediaKind: "image" | "video";
    contentHash?: string | null;
    templateId?: string | null;
    uploadSessionId?: string | null;
    createdBy?: string | null;
    createdByName?: string | null;
    deviceId?: string | null;
    endsAt: string;
  },
) {
  const title = input.title.trim().slice(0, 120) || "Phone upload";
  const row = {
    venue_id: input.venueId,
    title,
    public_url: input.publicUrl,
    storage_path: input.storagePath,
    media_kind: input.mediaKind,
    content_hash: input.contentHash ?? null,
    template_id: (input.templateId?.trim() || "classic").slice(0, 40),
    upload_session_id: input.uploadSessionId ?? null,
    created_by: input.createdBy ?? null,
    created_by_name: input.createdByName ?? null,
    device_id: input.deviceId ?? null,
    ends_at: input.endsAt,
  };

  if (input.uploadSessionId) {
    const { data: existing } = await client
      .from("server_station_upload_library")
      .select(
        "id, title, public_url, storage_path, media_kind, content_hash, template_id, ends_at, last_set_on_wall_at, created_at, created_by_name",
      )
      .eq("upload_session_id", input.uploadSessionId)
      .maybeSingle();
    if (existing) {
      return { ok: true as const, message: "Already in the temporary library.", item: mapRow(existing) };
    }
  }

  const { data, error } = await client
    .from("server_station_upload_library")
    .insert(row)
    .select(
      "id, title, public_url, storage_path, media_kind, content_hash, template_id, ends_at, last_set_on_wall_at, created_at, created_by_name",
    )
    .single();

  if (error) {
    return {
      ok: false as const,
      message: uploadLibraryMissingMessage(error.message),
      item: null,
    };
  }

  return {
    ok: true as const,
    message: "Saved to tonight’s temporary library.",
    item: data ? mapRow(data) : null,
  };
}

export async function listUploadLibrary(client: Client, venueId: string, limit = 24) {
  const nowIso = new Date().toISOString();
  const { data, error } = await client
    .from("server_station_upload_library")
    .select(
      "id, title, public_url, storage_path, media_kind, content_hash, template_id, ends_at, last_set_on_wall_at, created_at, created_by_name",
    )
    .eq("venue_id", venueId)
    .is("removed_at", null)
    .gt("ends_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return {
      items: [] as ServerStationUploadLibraryItem[],
      missingTable:
        isMissingServerStationRelation(error.message) ||
        (/server_station_upload_library/i.test(error.message) &&
          /does not exist|schema cache/i.test(error.message)),
      error: uploadLibraryMissingMessage(error.message),
    };
  }

  return {
    items: (data ?? []).map(mapRow),
    missingTable: false,
    error: null as string | null,
  };
}

export async function getUploadLibraryItem(client: Client, venueId: string, itemId: string) {
  const { data, error } = await client
    .from("server_station_upload_library")
    .select(
      "id, title, public_url, storage_path, media_kind, content_hash, template_id, ends_at, last_set_on_wall_at, created_at, created_by_name, removed_at",
    )
    .eq("id", itemId)
    .eq("venue_id", venueId)
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      message: uploadLibraryMissingMessage(error.message),
      item: null,
    };
  }
  if (!data || data.removed_at) {
    return { ok: false as const, message: "That upload is no longer in the temporary library.", item: null };
  }
  if (Date.parse(data.ends_at) <= Date.now()) {
    return { ok: false as const, message: "That upload expired with tonight’s library.", item: null };
  }
  return { ok: true as const, message: "ok", item: mapRow(data) };
}

export async function markUploadLibrarySetOnWall(client: Client, venueId: string, itemId: string) {
  const { error } = await client
    .from("server_station_upload_library")
    .update({ last_set_on_wall_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("venue_id", venueId);
  return { ok: !error, message: error?.message ?? null };
}

export async function removeUploadLibraryItem(client: Client, venueId: string, itemId: string) {
  const { error } = await client
    .from("server_station_upload_library")
    .update({ removed_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("venue_id", venueId)
    .is("removed_at", null);

  if (error) {
    return { ok: false as const, message: uploadLibraryMissingMessage(error.message) };
  }
  return { ok: true as const, message: "Removed from the temporary library." };
}

export async function expireUploadLibraryItems(client: Client, venueId: string, now = new Date()) {
  const nowIso = now.toISOString();
  const { data, error } = await client
    .from("server_station_upload_library")
    .update({ removed_at: nowIso })
    .eq("venue_id", venueId)
    .is("removed_at", null)
    .lte("ends_at", nowIso)
    .select("id");

  if (error) {
    if (
      isMissingServerStationRelation(error.message) ||
      (/server_station_upload_library/i.test(error.message) &&
        /does not exist|schema cache/i.test(error.message))
    ) {
      return { removed: 0, missingTable: true };
    }
    return { removed: 0, missingTable: false, error: error.message };
  }
  return { removed: data?.length ?? 0, missingTable: false };
}
