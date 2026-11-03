import { randomBytes, randomUUID } from "node:crypto";
import type { EventStatus, EventVisibility } from "@/lib/constants";
import { artistArtworkStoragePath } from "@/lib/events/artwork";
import type { EventWriteFields } from "@/lib/events/persist";
import { decideIdempotency } from "@/lib/integrations/idempotency";
import type { EventColumnPatch, EventParts, IntegrationArtwork, IntegrationScope } from "@/lib/integrations/contract";
import type {
  AuditWrite,
  IntegrationArtistRecord,
  IntegrationCredentialRecord,
  IntegrationStore,
  ListEventsQuery,
  RateLimitDecision,
  StoreFailure,
} from "@/lib/integrations/store";

type StoredArtist = {
  id: string;
  venueId: string;
  name: string;
  genre: string | null;
  archivedAt: string | null;
  artwork: IntegrationArtwork | null;
};

type StoredEvent = {
  id: string;
  venueId: string;
  title: string;
  publicDescription: string | null;
  internalNotes: string | null;
  eventType: EventParts["event_type"];
  startsAt: string;
  endsAt: string;
  locationLabel: string | null;
  status: EventStatus;
  visibility: EventVisibility;
  featured: boolean;
  archivedAt: string | null;
  isTicketed: boolean;
  ticketUrl: string | null;
  coverLabel: string | null;
  artistIds: string[];
  createdAt: string;
  updatedAt: string;
};

type IdempotencyRow = {
  requestHash: string;
  status: "pending" | "completed";
  parts?: EventParts;
};

type PreparedUpload = {
  venueId: string;
  artistId: string;
  contentType: string;
  byteSize: number;
  maxBytes: number;
};

export class MemoryIntegrationStore implements IntegrationStore {
  readonly credentials = new Map<string, IntegrationCredentialRecord>();
  readonly artists = new Map<string, StoredArtist>();
  readonly events = new Map<string, StoredEvent>();
  readonly audits: AuditWrite[] = [];
  private readonly idempotency = new Map<string, IdempotencyRow>();
  private readonly rateCounts = new Map<string, number>();
  private readonly prepared = new Map<string, PreparedUpload>();
  private readonly tails = new Map<string, Promise<unknown>>();
  private clock = Date.parse("2026-01-01T00:00:00.000Z");

  isConfigured() {
    return true;
  }

  async findCredentialByTokenHash(tokenHash: string) {
    for (const credential of this.credentials.values()) {
      if (credential.tokenHash === tokenHash) return credential;
    }
    return null;
  }

  async touchCredential(id: string) {
    const credential = this.credentials.get(id);
    if (credential) this.credentials.set(id, { ...credential });
  }

  async consumeRateLimit(bucketKey: string, limit: number, windowSeconds: number, now: Date): Promise<RateLimitDecision> {
    const windowStart = Math.floor(now.getTime() / 1000 / windowSeconds) * windowSeconds;
    const key = `${bucketKey}:${windowStart}`;
    const count = (this.rateCounts.get(key) ?? 0) + 1;
    this.rateCounts.set(key, count);
    if (count > limit) {
      const retryAfterSeconds = Math.max(1, windowStart + windowSeconds - Math.floor(now.getTime() / 1000));
      return { allowed: false, remaining: 0, retryAfterSeconds, limit };
    }
    return { allowed: true, remaining: limit - count, retryAfterSeconds: 0, limit };
  }

  async writeAudit(entry: AuditWrite) {
    this.audits.push(entry);
  }

  async listEvents(query: ListEventsQuery) {
    const scope = this.requireScope(query.credentialId, query.venueId, "events:read");
    if (scope) return scope;
    const events = [...this.events.values()]
      .filter((event) => event.venueId === query.venueId)
      .filter((event) => query.includeArchived || event.archivedAt === null)
      .filter((event) => !query.statuses || query.statuses.includes(event.status))
      .filter((event) => !query.visibility || event.visibility === query.visibility)
      .filter((event) => !query.fromIso || Date.parse(event.startsAt) >= Date.parse(query.fromIso))
      .filter((event) => !query.toIso || Date.parse(event.startsAt) <= Date.parse(query.toIso))
      .filter((event) => {
        if (!query.cursor) return true;
        const start = Date.parse(event.startsAt);
        const cursorStart = Date.parse(query.cursor.startsAt);
        return start > cursorStart || (start === cursorStart && event.id > query.cursor.id);
      })
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id.localeCompare(b.id))
      .slice(0, query.limit)
      .map((event) => this.partsFromEvent(event));
    await this.writeAudit({
      venueId: query.venueId,
      credentialId: query.credentialId,
      action: "events.list",
      eventId: null,
      requestId: query.requestId,
      reportedActor: query.reportedActor,
      metadata: { returned: events.length },
    });
    return { ok: true as const, events };
  }

  async getEvent(input: {
    credentialId: string;
    venueId: string;
    eventId: string;
    requestId: string;
    reportedActor: string | null;
  }) {
    const scope = this.requireAnyScope(input.credentialId, input.venueId, ["events:read", "events:write"]);
    if (scope) return scope;
    const event = this.events.get(input.eventId);
    if (!event || event.venueId !== input.venueId) return { ok: false as const, code: "not_found" as const };
    await this.writeAudit({
      venueId: input.venueId,
      credentialId: input.credentialId,
      action: "events.read",
      eventId: event.id,
      requestId: input.requestId,
      reportedActor: input.reportedActor,
    });
    return { ok: true as const, parts: this.partsFromEvent(event) };
  }

  async createEvent(input: {
    credentialId: string;
    venueId: string;
    idempotencyKey: string;
    requestHash: string;
    fields: EventWriteFields;
    artistIds: string[];
    requestId: string;
    reportedActor: string | null;
  }) {
    return this.exclusive(`idem:${input.credentialId}:${input.idempotencyKey}`, async () => {
      const scope = this.requireScope(input.credentialId, input.venueId, "events:write");
      if (scope) return scope;
      if (!this.artistIdsInVenue(input.venueId, input.artistIds)) {
        return { ok: false as const, code: "invalid_artists" as const };
      }
      const key = `${input.credentialId}:${input.idempotencyKey}`;
      const decision = decideIdempotency(this.idempotency.get(key) ?? null, input.requestHash);
      if (decision === "conflict") return { ok: false as const, code: "idempotency_conflict" as const };
      if (decision === "in_progress") return { ok: false as const, code: "idempotency_in_progress" as const };
      if (decision === "replay") {
        const existing = this.idempotency.get(key);
        await this.writeAudit({
          venueId: input.venueId,
          credentialId: input.credentialId,
          action: "events.create",
          eventId: existing?.parts?.id ?? null,
          requestId: input.requestId,
          reportedActor: input.reportedActor,
          metadata: { replay: true },
        });
        return { ok: true as const, replay: true, parts: existing!.parts! };
      }

      const now = this.nextIso();
      const event: StoredEvent = {
        id: randomUUID(),
        venueId: input.venueId,
        title: input.fields.title,
        publicDescription: input.fields.public_description,
        internalNotes: input.fields.internal_notes,
        eventType: input.fields.event_type,
        startsAt: input.fields.starts_at,
        endsAt: input.fields.ends_at,
        locationLabel: input.fields.location_label,
        status: input.fields.status,
        visibility: input.fields.visibility,
        featured: input.fields.featured,
        archivedAt: null,
        isTicketed: input.fields.is_ticketed,
        ticketUrl: input.fields.ticket_url,
        coverLabel: input.fields.cover_label,
        artistIds: input.artistIds,
        createdAt: now,
        updatedAt: now,
      };
      this.events.set(event.id, event);
      const parts = this.partsFromEvent(event);
      this.idempotency.set(key, { requestHash: input.requestHash, status: "completed", parts: structuredClone(parts) });
      await this.writeAudit({
        venueId: input.venueId,
        credentialId: input.credentialId,
        action: "events.create",
        eventId: event.id,
        requestId: input.requestId,
        reportedActor: input.reportedActor,
        metadata: { replay: false, status: event.status, visibility: event.visibility },
      });
      return { ok: true as const, replay: false, parts };
    });
  }

  async updateEvent(input: {
    credentialId: string;
    venueId: string;
    eventId: string;
    expectedUpdatedAt: string;
    columnPatch: EventColumnPatch;
    replaceArtists: boolean;
    artistIds: string[];
    requestId: string;
    reportedActor: string | null;
  }) {
    return this.exclusive(`event:${input.eventId}`, async () => {
      const scope = this.requireScope(input.credentialId, input.venueId, "events:write");
      if (scope) return scope;
      if (input.replaceArtists && !this.artistIdsInVenue(input.venueId, input.artistIds)) {
        return { ok: false as const, code: "invalid_artists" as const };
      }
      const event = this.events.get(input.eventId);
      if (!event || event.venueId !== input.venueId) return { ok: false as const, code: "not_found" as const };
      if (Date.parse(event.updatedAt) !== Date.parse(input.expectedUpdatedAt)) {
        await this.writeAudit({
          venueId: input.venueId,
          credentialId: input.credentialId,
          action: "events.update",
          eventId: event.id,
          requestId: input.requestId,
          reportedActor: input.reportedActor,
          metadata: { result: "edit_conflict" },
        });
        return { ok: false as const, code: "edit_conflict" as const, currentUpdatedAt: event.updatedAt };
      }

      const next: StoredEvent = { ...event, updatedAt: this.nextIso() };
      if (input.columnPatch.title !== undefined) next.title = input.columnPatch.title;
      if ("public_description" in input.columnPatch) next.publicDescription = input.columnPatch.public_description ?? null;
      if ("internal_notes" in input.columnPatch) next.internalNotes = input.columnPatch.internal_notes ?? null;
      if (input.columnPatch.event_type !== undefined) next.eventType = input.columnPatch.event_type;
      if (input.columnPatch.starts_at !== undefined) next.startsAt = input.columnPatch.starts_at;
      if (input.columnPatch.ends_at !== undefined) next.endsAt = input.columnPatch.ends_at;
      if ("location_label" in input.columnPatch) next.locationLabel = input.columnPatch.location_label ?? null;
      if (input.columnPatch.status !== undefined) next.status = input.columnPatch.status;
      if (input.columnPatch.visibility !== undefined) next.visibility = input.columnPatch.visibility;
      if (input.columnPatch.featured !== undefined) next.featured = input.columnPatch.featured;
      if (input.columnPatch.is_ticketed !== undefined) next.isTicketed = input.columnPatch.is_ticketed;
      if ("ticket_url" in input.columnPatch) next.ticketUrl = input.columnPatch.ticket_url ?? null;
      if ("cover_label" in input.columnPatch) next.coverLabel = input.columnPatch.cover_label ?? null;
      if (input.columnPatch.archived === true) next.archivedAt = next.archivedAt ?? this.nextIso();
      if (input.columnPatch.archived === false) next.archivedAt = null;
      if (input.replaceArtists) next.artistIds = input.artistIds;
      this.events.set(next.id, next);
      await this.writeAudit({
        venueId: input.venueId,
        credentialId: input.credentialId,
        action: "events.update",
        eventId: next.id,
        requestId: input.requestId,
        reportedActor: input.reportedActor,
        metadata: { result: "updated", status: next.status, visibility: next.visibility },
      });
      return { ok: true as const, parts: this.partsFromEvent(next) };
    });
  }

  async listArtists(input: {
    credentialId: string;
    venueId: string;
    query: string;
    limit: number;
    cursor: { name: string; id: string } | null;
    requestId: string;
    reportedActor: string | null;
  }) {
    const scope = this.requireScope(input.credentialId, input.venueId, "artists:read");
    if (scope) return scope;
    const needle = input.query.trim().toLowerCase();
    const artists = [...this.artists.values()]
      .filter((artist) => artist.venueId === input.venueId && artist.archivedAt === null)
      .filter((artist) => !needle || artist.name.toLowerCase().includes(needle) || (artist.genre ?? "").toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
      .filter((artist) => {
        if (!input.cursor) return true;
        return artist.name > input.cursor.name || (artist.name === input.cursor.name && artist.id > input.cursor.id);
      })
      .slice(0, input.limit)
      .map((artist) => this.artistRecord(artist));
    await this.writeAudit({
      venueId: input.venueId,
      credentialId: input.credentialId,
      action: "artists.list",
      eventId: null,
      requestId: input.requestId,
      reportedActor: input.reportedActor,
      metadata: { returned: artists.length },
    });
    return { ok: true as const, artists };
  }

  async prepareArtwork(input: {
    credentialId: string;
    venueId: string;
    artistId: string;
    contentType: string;
    byteSize: number;
    extension: string;
    maxBytes: number;
    requestId: string;
    reportedActor: string | null;
  }) {
    const scope = this.requireScope(input.credentialId, input.venueId, "artwork:write");
    if (scope) return scope;
    const artist = this.artists.get(input.artistId);
    if (!artist || artist.venueId !== input.venueId || artist.archivedAt) {
      return { ok: false as const, code: "not_found" as const };
    }
    if (input.byteSize < 1 || input.byteSize > input.maxBytes) {
      return { ok: false as const, code: "invalid_input" as const, message: "Artwork exceeds the size limit for that file type." };
    }
    const storagePath = artistArtworkStoragePath(input.venueId, input.artistId, input.extension, randomBytes(12).toString("base64url"));
    this.prepared.set(storagePath, {
      venueId: input.venueId,
      artistId: input.artistId,
      contentType: input.contentType,
      byteSize: input.byteSize,
      maxBytes: input.maxBytes,
    });
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
      ok: true as const,
      upload: {
        storagePath,
        signedUrl: `https://uploads.example.test/${storagePath}?token=signed-upload-token`,
        token: "signed-upload-token",
        contentType: input.contentType,
        maxBytes: input.maxBytes,
      },
    };
  }

  async completeArtwork(input: {
    credentialId: string;
    venueId: string;
    artistId: string;
    storagePath: string;
    contentType: string;
    requestId: string;
    reportedActor: string | null;
  }) {
    const scope = this.requireScope(input.credentialId, input.venueId, "artwork:write");
    if (scope) return scope;
    const artist = this.artists.get(input.artistId);
    if (!artist || artist.venueId !== input.venueId || artist.archivedAt) {
      return { ok: false as const, code: "not_found" as const };
    }
    const prepared = this.prepared.get(input.storagePath);
    if (!prepared || prepared.artistId !== input.artistId || prepared.venueId !== input.venueId || prepared.contentType !== input.contentType) {
      return { ok: false as const, code: "invalid_input" as const, message: "Upload the artwork before saving it." };
    }
    const mediaKind = input.contentType === "video/mp4" ? "video" : "image";
    const artwork: IntegrationArtwork = {
      mediaKind,
      publicUrl: `https://cdn.example.test/${input.storagePath}`,
      enabled: true,
    };
    this.artists.set(artist.id, { ...artist, artwork });
    await this.writeAudit({
      venueId: input.venueId,
      credentialId: input.credentialId,
      action: "artwork.complete",
      eventId: null,
      requestId: input.requestId,
      reportedActor: input.reportedActor,
      metadata: { artistId: input.artistId, mediaKind },
    });
    return { ok: true as const, artwork: { ...artwork, artistId: artist.id, storagePath: input.storagePath } };
  }

  private requireScope(credentialId: string, venueId: string, scope: IntegrationScope): StoreFailure | null {
    return this.requireAnyScope(credentialId, venueId, [scope]);
  }

  private requireAnyScope(credentialId: string, venueId: string, scopes: IntegrationScope[]): StoreFailure | null {
    const credential = this.credentials.get(credentialId);
    if (
      !credential ||
      credential.revokedAt ||
      credential.venueId !== venueId ||
      !scopes.some((scope) => credential.scopes.includes(scope))
    ) {
      return { ok: false, code: "forbidden" };
    }
    return null;
  }

  private artistIdsInVenue(venueId: string, artistIds: string[]) {
    return artistIds.every((artistId) => {
      const artist = this.artists.get(artistId);
      return Boolean(artist && artist.venueId === venueId);
    });
  }

  private partsFromEvent(event: StoredEvent): EventParts {
    return {
      id: event.id,
      venue_id: event.venueId,
      title: event.title,
      public_description: event.publicDescription,
      internal_notes: event.internalNotes,
      event_type: event.eventType,
      starts_at: event.startsAt,
      ends_at: event.endsAt,
      location_label: event.locationLabel,
      status: event.status,
      visibility: event.visibility,
      featured: event.featured,
      archived_at: event.archivedAt,
      is_ticketed: event.isTicketed,
      ticket_url: event.ticketUrl,
      cover_label: event.coverLabel,
      created_at: event.createdAt,
      updated_at: event.updatedAt,
      artists: event.artistIds.map((artistId, index) => {
        const artist = this.artists.get(artistId);
        return {
          id: artistId,
          name: artist?.name ?? "Unknown artist",
          display_order: index,
          artwork: artist?.artwork
            ? {
                media_kind: artist.artwork.mediaKind,
                public_url: artist.artwork.publicUrl,
                enabled: artist.artwork.enabled,
              }
            : null,
        };
      }),
    };
  }

  private artistRecord(artist: StoredArtist): IntegrationArtistRecord {
    return {
      id: artist.id,
      name: artist.name,
      genre: artist.genre,
      artwork: artist.artwork,
    };
  }

  private nextIso() {
    this.clock += 1;
    return new Date(this.clock).toISOString();
  }

  private exclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    const run = previous.then(fn, fn);
    this.tails.set(
      key,
      run.then(
        () => undefined,
        () => undefined,
      ),
    );
    return run;
  }
}

export class UnconfiguredIntegrationStore implements IntegrationStore {
  isConfigured() {
    return false;
  }

  private unavailable(): never {
    throw new Error("Event integration storage is not configured.");
  }

  findCredentialByTokenHash(): Promise<IntegrationCredentialRecord | null> {
    this.unavailable();
  }
  touchCredential(): Promise<void> {
    this.unavailable();
  }
  consumeRateLimit(): Promise<RateLimitDecision> {
    this.unavailable();
  }
  writeAudit(): Promise<void> {
    this.unavailable();
  }
  listEvents(): Promise<{ ok: true; events: EventParts[] } | StoreFailure> {
    this.unavailable();
  }
  getEvent(): Promise<{ ok: true; parts: EventParts } | StoreFailure> {
    this.unavailable();
  }
  createEvent(): Promise<{ ok: true; replay: boolean; parts: EventParts } | StoreFailure> {
    this.unavailable();
  }
  updateEvent(): Promise<{ ok: true; parts: EventParts } | StoreFailure> {
    this.unavailable();
  }
  listArtists(): Promise<{ ok: true; artists: IntegrationArtistRecord[] } | StoreFailure> {
    this.unavailable();
  }
  prepareArtwork(): Promise<
    | {
        ok: true;
        upload: { storagePath: string; signedUrl: string; token: string; contentType: string; maxBytes: number };
      }
    | StoreFailure
  > {
    this.unavailable();
  }
  completeArtwork(): Promise<{ ok: true; artwork: IntegrationArtwork & { artistId: string; storagePath: string } } | StoreFailure> {
    this.unavailable();
  }
}
