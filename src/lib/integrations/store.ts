import type { EventStatus, EventVisibility } from "@/lib/constants";
import type { IntegrationArtworkContentType } from "@/lib/events/artwork";
import type { EventColumnPatch, EventParts, IntegrationArtwork, IntegrationScope } from "@/lib/integrations/contract";
import type { EventWriteFields } from "@/lib/events/persist";

export type IntegrationCredentialRecord = {
  id: string;
  venueId: string;
  name: string;
  tokenHash: string;
  scopes: IntegrationScope[];
  revokedAt: string | null;
};

export type RateLimitDecision = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  limit: number;
};

export type AuditWrite = {
  venueId: string | null;
  credentialId: string | null;
  action: string;
  eventId: string | null;
  requestId: string;
  reportedActor: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};

export type StoreErrorCode =
  | "forbidden"
  | "not_found"
  | "invalid_artists"
  | "invalid_input"
  | "idempotency_conflict"
  | "idempotency_in_progress"
  | "edit_conflict"
  | "not_ready"
  | "server_error";

export type StoreFailure = {
  ok: false;
  code: StoreErrorCode;
  message?: string;
  currentUpdatedAt?: string;
  logMessage?: string;
};

export type ListEventsQuery = {
  credentialId: string;
  venueId: string;
  fromIso: string | null;
  toIso: string | null;
  statuses: EventStatus[] | null;
  visibility: EventVisibility | null;
  includeArchived: boolean;
  limit: number;
  cursor: { startsAt: string; id: string } | null;
  requestId: string;
  reportedActor: string | null;
};

export type IntegrationArtistRecord = {
  id: string;
  name: string;
  genre: string | null;
  artwork: IntegrationArtwork | null;
};

export type IntegrationStore = {
  isConfigured(): boolean;
  findCredentialByTokenHash(tokenHash: string): Promise<IntegrationCredentialRecord | null>;
  touchCredential(id: string, atIso: string): Promise<void>;
  consumeRateLimit(bucketKey: string, limit: number, windowSeconds: number, now: Date): Promise<RateLimitDecision>;
  writeAudit(entry: AuditWrite): Promise<void>;
  listEvents(query: ListEventsQuery): Promise<{ ok: true; events: EventParts[] } | StoreFailure>;
  getEvent(input: {
    credentialId: string;
    venueId: string;
    eventId: string;
    requestId: string;
    reportedActor: string | null;
  }): Promise<{ ok: true; parts: EventParts } | StoreFailure>;
  createEvent(input: {
    credentialId: string;
    venueId: string;
    idempotencyKey: string;
    requestHash: string;
    fields: EventWriteFields;
    artistIds: string[];
    requestId: string;
    reportedActor: string | null;
  }): Promise<{ ok: true; replay: boolean; parts: EventParts } | StoreFailure>;
  updateEvent(input: {
    credentialId: string;
    venueId: string;
    eventId: string;
    expectedUpdatedAt: string;
    columnPatch: EventColumnPatch;
    replaceArtists: boolean;
    artistIds: string[];
    requestId: string;
    reportedActor: string | null;
  }): Promise<{ ok: true; parts: EventParts } | StoreFailure>;
  listArtists(input: {
    credentialId: string;
    venueId: string;
    query: string;
    limit: number;
    cursor: { name: string; id: string } | null;
    requestId: string;
    reportedActor: string | null;
  }): Promise<{ ok: true; artists: IntegrationArtistRecord[] } | StoreFailure>;
  prepareArtwork(input: {
    credentialId: string;
    venueId: string;
    artistId: string;
    contentType: IntegrationArtworkContentType;
    byteSize: number;
    extension: string;
    maxBytes: number;
    requestId: string;
    reportedActor: string | null;
  }): Promise<
    | {
        ok: true;
        upload: {
          storagePath: string;
          signedUrl: string;
          token: string;
          contentType: string;
          maxBytes: number;
        };
      }
    | StoreFailure
  >;
  completeArtwork(input: {
    credentialId: string;
    venueId: string;
    artistId: string;
    storagePath: string;
    contentType: string;
    requestId: string;
    reportedActor: string | null;
  }): Promise<{ ok: true; artwork: IntegrationArtwork & { artistId: string; storagePath: string } } | StoreFailure>;
};
