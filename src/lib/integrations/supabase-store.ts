import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import {
  artistArtworkStoragePath,
  contentTypeMatchesArtworkPath,
  integrationArtworkSpec,
  isArtistArtworkStoragePath,
  upsertArtistLedMedia,
} from "@/lib/events/artwork";
import {
  INTEGRATION_SCOPES,
  parseEventParts,
  type EventParts,
  type IntegrationArtwork,
  type IntegrationScope,
} from "@/lib/integrations/contract";
import type {
  AuditWrite,
  IntegrationArtistRecord,
  IntegrationCredentialRecord,
  IntegrationStore,
  RateLimitDecision,
  StoreFailure,
} from "@/lib/integrations/store";

type Admin = SupabaseClient<Database>;

export class IntegrationNotReadyError extends Error {
  constructor() {
    super("Event integration storage is not ready.");
    this.name = "IntegrationNotReadyError";
  }
}

export function isMissingIntegrationSchema(message: string) {
  return /integration_|schema cache|could not find the function|does not exist/i.test(message);
}

export class SupabaseIntegrationStore implements IntegrationStore {
  constructor(private readonly admin: Admin) {}

  isConfigured() {
    return true;
  }

  async findCredentialByTokenHash(tokenHash: string) {
    const { data, error } = await this.admin
      .from("integration_credentials")
      .select("id, venue_id, name, token_hash, scopes, revoked_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (error) this.raise(error.message);
    if (!data) return null;
    const scopes = (data.scopes ?? []).filter((scope): scope is IntegrationScope =>
      (INTEGRATION_SCOPES as readonly string[]).includes(scope),
    );
    return {
      id: data.id,
      venueId: data.venue_id,
      name: data.name,
      tokenHash: data.token_hash,
      scopes,
      revokedAt: data.revoked_at,
    } satisfies IntegrationCredentialRecord;
  }

  async touchCredential(id: string, atIso: string) {
    await this.admin.from("integration_credentials").update({ last_used_at: atIso }).eq("id", id);
  }

  async consumeRateLimit(bucketKey: string, limit: number, windowSeconds: number): Promise<RateLimitDecision> {
    const { data, error } = await this.admin.rpc("integration_consume_rate_limit", {
      p_bucket_key: bucketKey,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) this.raise(error.message);
    const record = asRecord(data);
    if (!record || typeof record.allowed !== "boolean") {
      throw new Error("Rate limit response was incomplete.");
    }
    return {
      allowed: record.allowed,
      remaining: numberValue(record.remaining),
      retryAfterSeconds: numberValue(record.retryAfterSeconds),
      limit: numberValue(record.limit) || limit,
    };
  }

  async writeAudit(entry: AuditWrite) {
    const { error } = await this.admin.from("integration_audit_log").insert({
      venue_id: entry.venueId,
      credential_id: entry.credentialId,
      action: entry.action,
      event_id: entry.eventId,
      request_id: entry.requestId,
      reported_actor: entry.reportedActor,
      metadata: (entry.metadata ?? {}) as Json,
    });
    if (error) this.raise(error.message);
  }

  async listEvents(query: Parameters<IntegrationStore["listEvents"]>[0]): ReturnType<IntegrationStore["listEvents"]> {
    const { data, error } = await this.admin.rpc("integration_list_events", {
      p_credential_id: query.credentialId,
      p_venue_id: query.venueId,
      p_from: query.fromIso,
      p_to: query.toIso,
      p_statuses: query.statuses,
      p_visibility: query.visibility,
      p_include_archived: query.includeArchived,
      p_limit: query.limit,
      p_cursor_starts_at: query.cursor?.startsAt ?? null,
      p_cursor_id: query.cursor?.id ?? null,
      p_request_id: query.requestId,
      p_reported_actor: query.reportedActor,
    });
    if (error) return this.rpcFailure(error.message);
    return this.partsList(data);
  }

  async getEvent(input: Parameters<IntegrationStore["getEvent"]>[0]): ReturnType<IntegrationStore["getEvent"]> {
    const { data, error } = await this.admin.rpc("integration_get_event", {
      p_credential_id: input.credentialId,
      p_venue_id: input.venueId,
      p_event_id: input.eventId,
      p_request_id: input.requestId,
      p_reported_actor: input.reportedActor,
    });
    if (error) return this.rpcFailure(error.message);
    return this.oneParts(data);
  }

  async createEvent(input: Parameters<IntegrationStore["createEvent"]>[0]): ReturnType<IntegrationStore["createEvent"]> {
    const { data, error } = await this.admin.rpc("integration_commit_event_create", {
      p_credential_id: input.credentialId,
      p_venue_id: input.venueId,
      p_idempotency_key: input.idempotencyKey,
      p_request_hash: input.requestHash,
      p_fields: input.fields as unknown as Json,
      p_artist_ids: input.artistIds,
      p_request_id: input.requestId,
      p_reported_actor: input.reportedActor,
    });
    if (error) return this.rpcFailure(error.message);
    const record = asRecord(data);
    if (!record) return { ok: false, code: "server_error", logMessage: "Create response was empty." };
    if (record.ok !== true) return this.failureRecord(record);
    const parts = parseEventParts(record.parts);
    if (!parts) return { ok: false, code: "server_error", logMessage: "Create snapshot did not match the contract." };
    return { ok: true, replay: record.replay === true, parts };
  }

  async updateEvent(input: Parameters<IntegrationStore["updateEvent"]>[0]): ReturnType<IntegrationStore["updateEvent"]> {
    const { data, error } = await this.admin.rpc("integration_commit_event_update", {
      p_credential_id: input.credentialId,
      p_venue_id: input.venueId,
      p_event_id: input.eventId,
      p_expected_updated_at: input.expectedUpdatedAt,
      p_patch: input.columnPatch as unknown as Json,
      p_artist_ids: input.artistIds,
      p_replace_artists: input.replaceArtists,
      p_request_id: input.requestId,
      p_reported_actor: input.reportedActor,
    });
    if (error) return this.rpcFailure(error.message);
    const record = asRecord(data);
    if (!record) return { ok: false, code: "server_error", logMessage: "Update response was empty." };
    if (record.ok !== true) return this.failureRecord(record);
    const parts = parseEventParts(record.parts);
    if (!parts) return { ok: false, code: "server_error", logMessage: "Update snapshot did not match the contract." };
    return { ok: true, parts };
  }

  async listArtists(input: Parameters<IntegrationStore["listArtists"]>[0]): ReturnType<IntegrationStore["listArtists"]> {
    let request = this.admin
      .from("artists")
      .select("id, name, genre, archived_at")
      .eq("venue_id", input.venueId)
      .is("archived_at", null)
      .order("name", { ascending: true })
      .order("id", { ascending: true })
      .limit(500);
    if (input.query.trim()) {
      const escaped = input.query.trim().replace(/[%_\\,]/g, "");
      request = request.or(`name.ilike.%${escaped}%,genre.ilike.%${escaped}%`);
    }
    const { data, error } = await request;
    if (error) this.raise(error.message);
    const rows = data ?? [];
    const filtered = input.cursor
      ? rows.filter((artist) => artist.name > input.cursor!.name || (artist.name === input.cursor!.name && artist.id > input.cursor!.id))
      : rows;
    const ids = filtered.map((artist) => artist.id);
    const artwork = await this.artworkByArtist(input.venueId, ids);
    await this.writeAudit({
      venueId: input.venueId,
      credentialId: input.credentialId,
      action: "artists.list",
      eventId: null,
      requestId: input.requestId,
      reportedActor: input.reportedActor,
      metadata: { returned: filtered.length },
    });
    const artists: IntegrationArtistRecord[] = filtered.map((artist) => ({
      id: artist.id,
      name: artist.name,
      genre: artist.genre,
      artwork: artwork.get(artist.id) ?? null,
    }));
    return { ok: true, artists };
  }

  async prepareArtwork(input: Parameters<IntegrationStore["prepareArtwork"]>[0]): ReturnType<IntegrationStore["prepareArtwork"]> {
    const artist = await this.activeArtist(input.venueId, input.artistId);
    if (!artist) return { ok: false, code: "not_found" };
    const storagePath = artistArtworkStoragePath(
      input.venueId,
      input.artistId,
      input.extension,
      randomBytes(12).toString("base64url"),
    );
    const signed = await this.admin.storage.from("screen-ads").createSignedUploadUrl(storagePath);
    if (signed.error || !signed.data) {
      return { ok: false, code: "server_error", logMessage: signed.error?.message ?? "Could not prepare artwork upload." };
    }
    await this.writeAudit({
      venueId: input.venueId,
      credentialId: input.credentialId,
      action: "artwork.prepare",
      eventId: null,
      requestId: input.requestId,
      reportedActor: input.reportedActor,
      metadata: { artistId: input.artistId, contentType: input.contentType, byteSize: input.byteSize },
    });
    return {
      ok: true,
      upload: {
        storagePath,
        signedUrl: signed.data.signedUrl,
        token: signed.data.token,
        contentType: input.contentType,
        maxBytes: input.maxBytes,
      },
    };
  }

  async completeArtwork(input: Parameters<IntegrationStore["completeArtwork"]>[0]): ReturnType<IntegrationStore["completeArtwork"]> {
    const artist = await this.activeArtist(input.venueId, input.artistId);
    if (!artist) return { ok: false, code: "not_found" };
    if (
      !isArtistArtworkStoragePath(input.venueId, input.artistId, input.storagePath) ||
      !contentTypeMatchesArtworkPath(input.contentType, input.storagePath)
    ) {
      return { ok: false, code: "invalid_input", message: "Upload the artwork before saving it." };
    }
    const spec = integrationArtworkSpec(input.contentType);
    if (!spec) return { ok: false, code: "invalid_input", message: "That artwork type is not allowed." };
    const folder = input.storagePath.slice(0, input.storagePath.lastIndexOf("/"));
    const filename = input.storagePath.slice(folder.length + 1);
    const listed = await this.admin.storage.from("screen-ads").list(folder, { search: filename, limit: 20 });
    if (listed.error) return { ok: false, code: "server_error", logMessage: listed.error.message };
    const match = (listed.data ?? []).find((file) => file.name === filename);
    if (!match) return { ok: false, code: "invalid_input", message: "Upload the artwork before saving it." };
    const size = typeof match.metadata?.size === "number" ? match.metadata.size : null;
    if (size != null && size > spec.maxBytes) {
      return { ok: false, code: "invalid_input", message: "Artwork exceeds the size limit for that file type." };
    }
    const publicUrl = this.admin.storage.from("screen-ads").getPublicUrl(input.storagePath).data.publicUrl;
    const saved = await upsertArtistLedMedia(this.admin, {
      venueId: input.venueId,
      artistId: input.artistId,
      title: artist.name,
      mediaKind: spec.mediaKind,
      storagePath: input.storagePath,
      publicUrl,
      replaceDefaultIfPresent: true,
    });
    if (!saved.ok) return { ok: false, code: "server_error", logMessage: saved.message };
    await this.writeAudit({
      venueId: input.venueId,
      credentialId: input.credentialId,
      action: "artwork.complete",
      eventId: null,
      requestId: input.requestId,
      reportedActor: input.reportedActor,
      metadata: { artistId: input.artistId, mediaKind: spec.mediaKind },
    });
    const artwork: IntegrationArtwork & { artistId: string; storagePath: string } = {
      artistId: input.artistId,
      storagePath: input.storagePath,
      mediaKind: spec.mediaKind,
      publicUrl,
      enabled: true,
    };
    return { ok: true, artwork };
  }

  private async activeArtist(venueId: string, artistId: string) {
    const { data, error } = await this.admin
      .from("artists")
      .select("id, name, archived_at")
      .eq("id", artistId)
      .eq("venue_id", venueId)
      .maybeSingle();
    if (error) this.raise(error.message);
    if (!data || data.archived_at) return null;
    return data;
  }

  private async artworkByArtist(venueId: string, artistIds: string[]) {
    const map = new Map<string, IntegrationArtwork>();
    if (artistIds.length === 0) return map;
    const { data, error } = await this.admin
      .from("led_wall_scenes")
      .select("artist_id, media_kind, public_url, enabled")
      .eq("venue_id", venueId)
      .in("artist_id", artistIds);
    if (error) this.raise(error.message);
    for (const row of data ?? []) {
      if (!row.artist_id) continue;
      map.set(row.artist_id, {
        mediaKind: row.media_kind === "image" || row.media_kind === "video" ? row.media_kind : null,
        publicUrl: row.public_url,
        enabled: row.enabled,
      });
    }
    return map;
  }

  private partsList(data: unknown): { ok: true; events: EventParts[] } | StoreFailure {
    const record = asRecord(data);
    if (!record) return { ok: false, code: "server_error", logMessage: "List response was empty." };
    if (record.ok !== true) return this.failureRecord(record);
    if (!Array.isArray(record.events)) return { ok: false, code: "server_error", logMessage: "List response was incomplete." };
    const events: EventParts[] = [];
    for (const item of record.events) {
      const parts = parseEventParts(item);
      if (!parts) return { ok: false, code: "server_error", logMessage: "List snapshot did not match the contract." };
      events.push(parts);
    }
    return { ok: true, events };
  }

  private oneParts(data: unknown): { ok: true; parts: EventParts } | StoreFailure {
    const record = asRecord(data);
    if (!record) return { ok: false, code: "server_error", logMessage: "Read response was empty." };
    if (record.ok !== true) return this.failureRecord(record);
    const parts = parseEventParts(record.parts);
    if (!parts) return { ok: false, code: "server_error", logMessage: "Read snapshot did not match the contract." };
    return { ok: true, parts };
  }

  private failureRecord(record: Record<string, unknown>): StoreFailure {
    const code = typeof record.code === "string" ? record.code : "server_error";
    const known: StoreFailure["code"][] = [
      "forbidden",
      "not_found",
      "invalid_artists",
      "invalid_input",
      "idempotency_conflict",
      "idempotency_in_progress",
      "edit_conflict",
      "not_ready",
      "server_error",
    ];
    const resolved = known.includes(code as StoreFailure["code"]) ? (code as StoreFailure["code"]) : "server_error";
    return {
      ok: false,
      code: resolved,
      currentUpdatedAt: typeof record.currentUpdatedAt === "string" ? record.currentUpdatedAt : undefined,
      logMessage: resolved === "server_error" ? "Integration write failed." : undefined,
    };
  }

  private rpcFailure(message: string): StoreFailure {
    if (isMissingIntegrationSchema(message)) return { ok: false, code: "not_ready", logMessage: message };
    return { ok: false, code: "server_error", logMessage: message };
  }

  private raise(message: string): never {
    if (isMissingIntegrationSchema(message)) throw new IntegrationNotReadyError();
    throw new Error(message);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      return asRecord(JSON.parse(value) as unknown);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
