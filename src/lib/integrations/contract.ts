import { z } from "zod";
import {
  DEFAULT_VENUE_TIMEZONE,
  EVENT_STATUSES,
  EVENT_TYPES,
  EVENT_VISIBILITIES,
  type EventStatus,
  type EventType,
  type EventVisibility,
} from "@/lib/constants";
import { EVENT_WRITE_COLUMNS, eventWriteFieldsFromForm, type EventWriteFields } from "@/lib/events/persist";
import { isPubliclyListable, toPublicEventJson } from "@/lib/public/listings";
import { parseVenueLocalDateTime, toVenueDateInput, toVenueTimeInput } from "@/lib/timezone";
import { eventFormSchema, type EventFormValues } from "@/lib/validation/schemas";
import { hashCreatePayload } from "@/lib/integrations/idempotency";
import { DateTime } from "luxon";

export const INTEGRATION_SCOPES = ["events:read", "events:write", "artists:read", "artwork:write"] as const;
export type IntegrationScope = (typeof INTEGRATION_SCOPES)[number];

export const INTEGRATION_CREATE_FIELDS = [
  "title",
  "eventType",
  "startDate",
  "startTime",
  "endDate",
  "endTime",
  "timeZone",
  "locationLabel",
  "publicDescription",
  "internalNotes",
  "status",
  "visibility",
  "featured",
  "isTicketed",
  "ticketUrl",
  "coverLabel",
  "artistIds",
] as const;

export const INTEGRATION_PATCH_FIELDS = [...INTEGRATION_CREATE_FIELDS, "archived"] as const;

export const INTEGRATION_PROTECTED_FIELDS = [
  "id",
  "venueId",
  "venue_id",
  "createdAt",
  "created_at",
  "updatedAt",
  "updated_at",
  "createdBy",
  "created_by",
  "updatedBy",
  "updated_by",
  "legacySourceId",
  "legacy_source_id",
  "archivedAt",
  "archived_at",
  "publiclyListed",
  "artists",
  "artwork",
  "publicUrl",
  "storagePath",
  "startsAt",
  "endsAt",
] as const;

export const EVENT_STATUS_TRANSITIONS: Record<EventStatus, readonly EventStatus[]> = {
  draft: ["draft", "published", "cancelled"],
  published: ["draft", "published", "cancelled"],
  cancelled: ["draft", "published", "cancelled"],
};

export function canTransitionEventStatus(from: EventStatus, to: EventStatus) {
  return EVENT_STATUS_TRANSITIONS[from].includes(to);
}

const REQUIRED_CREATE_FIELDS = [
  "title",
  "eventType",
  "startDate",
  "startTime",
  "endDate",
  "endTime",
  "status",
  "visibility",
] as const;

const NULLABLE_TEXT_FIELDS = [
  "locationLabel",
  "publicDescription",
  "internalNotes",
  "ticketUrl",
  "coverLabel",
] as const;

export type IntegrationArtwork = {
  mediaKind: "image" | "video" | null;
  publicUrl: string | null;
  enabled: boolean;
};

export type IntegrationArtistLink = {
  id: string;
  name: string;
  displayOrder: number;
  artwork: IntegrationArtwork | null;
};

export type IntegrationEvent = {
  id: string;
  venueId: string;
  title: string;
  publicDescription: string | null;
  internalNotes: string | null;
  eventType: EventType;
  startsAt: string;
  endsAt: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  timeZone: typeof DEFAULT_VENUE_TIMEZONE;
  locationLabel: string | null;
  status: EventStatus;
  visibility: EventVisibility;
  featured: boolean;
  archivedAt: string | null;
  isTicketed: boolean;
  ticketUrl: string | null;
  coverLabel: string | null;
  artists: IntegrationArtistLink[];
  createdAt: string;
  updatedAt: string;
  publiclyListed: boolean;
};

export type EventParts = {
  id: string;
  venue_id: string;
  title: string;
  public_description: string | null;
  internal_notes: string | null;
  event_type: EventType;
  starts_at: string;
  ends_at: string;
  location_label: string | null;
  status: EventStatus;
  visibility: EventVisibility;
  featured: boolean;
  archived_at: string | null;
  is_ticketed: boolean;
  ticket_url: string | null;
  cover_label: string | null;
  created_at: string;
  updated_at: string;
  artists: Array<{
    id: string;
    name: string;
    display_order: number;
    artwork: { media_kind: string | null; public_url: string | null; enabled: boolean } | null;
  }>;
};

export type EventColumnPatch = Partial<{
  title: string;
  public_description: string | null;
  internal_notes: string | null;
  event_type: EventType;
  starts_at: string;
  ends_at: string;
  location_label: string | null;
  status: EventStatus;
  visibility: EventVisibility;
  featured: boolean;
  is_ticketed: boolean;
  ticket_url: string | null;
  cover_label: string | null;
  archived: boolean;
}>;

export type ContractFailure = {
  ok: false;
  message: string;
  fieldErrors: Record<string, string[]>;
};

const artworkPartsSchema = z
  .object({
    media_kind: z.string().nullable(),
    public_url: z.string().nullable(),
    enabled: z.boolean(),
  })
  .nullable();

const eventPartsSchema = z.object({
  id: z.string().uuid(),
  venue_id: z.string().uuid(),
  title: z.string(),
  public_description: z.string().nullable(),
  internal_notes: z.string().nullable(),
  event_type: z.enum(EVENT_TYPES),
  starts_at: z.string().min(1),
  ends_at: z.string().min(1),
  location_label: z.string().nullable(),
  status: z.enum(EVENT_STATUSES),
  visibility: z.enum(EVENT_VISIBILITIES),
  featured: z.boolean(),
  archived_at: z.string().nullable(),
  is_ticketed: z.boolean(),
  ticket_url: z.string().nullable(),
  cover_label: z.string().nullable(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
  artists: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      display_order: z.number().int(),
      artwork: artworkPartsSchema,
    }),
  ),
});

export function parseEventParts(input: unknown): EventParts | null {
  const parsed = eventPartsSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

export function toIntegrationEvent(parts: EventParts): IntegrationEvent {
  const artists = [...parts.artists]
    .sort((a, b) => a.display_order - b.display_order || a.id.localeCompare(b.id))
    .map((artist): IntegrationArtistLink => {
      const rawKind = artist.artwork?.media_kind;
      const mediaKind: IntegrationArtwork["mediaKind"] =
        rawKind === "image" ? "image" : rawKind === "video" ? "video" : null;
      return {
        id: artist.id,
        name: artist.name,
        displayOrder: artist.display_order,
        artwork: artist.artwork
          ? {
              mediaKind,
              publicUrl: artist.artwork.public_url,
              enabled: artist.artwork.enabled,
            }
          : null,
      };
    });

  return {
    id: parts.id,
    venueId: parts.venue_id,
    title: parts.title,
    publicDescription: parts.public_description,
    internalNotes: parts.internal_notes,
    eventType: parts.event_type,
    startsAt: parts.starts_at,
    endsAt: parts.ends_at,
    startDate: toVenueDateInput(parts.starts_at),
    startTime: toVenueTimeInput(parts.starts_at),
    endDate: toVenueDateInput(parts.ends_at),
    endTime: toVenueTimeInput(parts.ends_at),
    timeZone: DEFAULT_VENUE_TIMEZONE,
    locationLabel: parts.location_label,
    status: parts.status,
    visibility: parts.visibility,
    featured: parts.featured,
    archivedAt: parts.archived_at,
    isTicketed: parts.is_ticketed,
    ticketUrl: parts.ticket_url,
    coverLabel: parts.cover_label,
    artists,
    createdAt: parts.created_at,
    updatedAt: parts.updated_at,
    publiclyListed: isPubliclyListable({
      id: parts.id,
      title: parts.title,
      event_type: parts.event_type,
      starts_at: parts.starts_at,
      ends_at: parts.ends_at,
      location_label: parts.location_label,
      featured: parts.featured,
      status: parts.status,
      visibility: parts.visibility,
      archived_at: parts.archived_at,
      internal_notes: parts.internal_notes,
    }),
  };
}

/** The public feed uses the same predicate and JSON shape as /api/public/v1/events. */
export function integrationEventToPublic(event: IntegrationEvent) {
  return toPublicEventJson({
    id: event.id,
    title: event.title,
    event_type: event.eventType,
    starts_at: event.startsAt,
    ends_at: event.endsAt,
    location_label: event.locationLabel,
    featured: event.featured,
    is_ticketed: event.isTicketed,
    ticket_url: event.ticketUrl,
    cover_label: event.coverLabel,
    status: event.status,
    visibility: event.visibility,
    archived_at: event.archivedAt,
    internal_notes: event.internalNotes,
    artists: event.artists.map((artist) => artist.name),
  });
}

export type ParsedCreate = {
  ok: true;
  values: EventFormValues;
  fields: EventWriteFields;
  artistIds: string[];
  requestHash: string;
};

export function parseCreateEvent(body: unknown): ParsedCreate | ContractFailure {
  const record = asRecord(body);
  if (!record) return failure("Send a JSON object.", { form: ["Send a JSON object."] });
  const keyErrors = rejectUnknownFields(record, INTEGRATION_CREATE_FIELDS);
  if (keyErrors) return failure("One or more fields cannot be set by this integration.", keyErrors);

  const fieldErrors: Record<string, string[]> = {};
  for (const key of REQUIRED_CREATE_FIELDS) {
    if (!(key in record)) fieldErrors[key] = ["This field is required."];
  }
  if (Object.keys(fieldErrors).length > 0) return failure("Check the highlighted fields.", fieldErrors);
  const nullErrors = rejectNullOnRequired(record);
  if (nullErrors) return failure("Check the highlighted fields.", nullErrors);
  const emptyText = rejectEmptyNullable(record);
  if (emptyText) return failure("Check the highlighted fields.", emptyText);

  const formInput = {
    title: record.title,
    eventType: record.eventType,
    startDate: record.startDate,
    startTime: record.startTime,
    endDate: record.endDate,
    endTime: record.endTime,
    timeZone: record.timeZone ?? DEFAULT_VENUE_TIMEZONE,
    locationLabel: formText(record.locationLabel),
    publicDescription: formText(record.publicDescription),
    internalNotes: formText(record.internalNotes),
    status: record.status,
    visibility: record.visibility,
    featured: record.featured ?? false,
    isTicketed: record.isTicketed ?? false,
    ticketUrl: formText(record.ticketUrl),
    coverLabel: formText(record.coverLabel),
    artistIds: record.artistIds ?? [],
  };

  if ("timeZone" in record) {
    const zoneError = timeZoneError(record.timeZone);
    if (zoneError) return failure("Check the highlighted fields.", { timeZone: [zoneError] });
  }

  return finishForm(formInput);
}

export type EventPatch = {
  title?: string;
  eventType?: EventType;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  timeZone?: string;
  locationLabel?: string | null;
  publicDescription?: string | null;
  internalNotes?: string | null;
  status?: EventStatus;
  visibility?: EventVisibility;
  featured?: boolean;
  isTicketed?: boolean;
  ticketUrl?: string | null;
  coverLabel?: string | null;
  artistIds?: string[];
  archived?: boolean;
};

export type ParsedPatch = {
  ok: true;
  values: EventFormValues;
  columnPatch: EventColumnPatch;
  replaceArtists: boolean;
  artistIds: string[];
};

export function parsePatchEvent(body: unknown, current: IntegrationEvent): ParsedPatch | ContractFailure {
  const record = asRecord(body);
  if (!record) return failure("Send a JSON object.", { form: ["Send a JSON object."] });
  const keyErrors = rejectUnknownFields(record, INTEGRATION_PATCH_FIELDS);
  if (keyErrors) return failure("One or more fields cannot be set by this integration.", keyErrors);
  if (Object.keys(record).length === 0) {
    return failure("Provide at least one field to update.", { form: ["Provide at least one field to update."] });
  }

  const emptyText = rejectEmptyNullable(record);
  if (emptyText) return failure("Check the highlighted fields.", emptyText);
  const nullErrors = rejectNullOnRequired(record);
  if (nullErrors) return failure("Check the highlighted fields.", nullErrors);
  if ("timeZone" in record) {
    const zoneError = timeZoneError(record.timeZone);
    if (zoneError) return failure("Check the highlighted fields.", { timeZone: [zoneError] });
  }
  if ("archived" in record && typeof record.archived !== "boolean") {
    return failure("Check the highlighted fields.", { archived: ["Expected true or false."] });
  }

  const formInput = {
    title: record.title ?? current.title,
    eventType: record.eventType ?? current.eventType,
    startDate: record.startDate ?? current.startDate,
    startTime: record.startTime ?? current.startTime,
    endDate: record.endDate ?? current.endDate,
    endTime: record.endTime ?? current.endTime,
    timeZone: record.timeZone ?? current.timeZone,
    locationLabel: "locationLabel" in record ? formText(record.locationLabel) : (current.locationLabel ?? ""),
    publicDescription: "publicDescription" in record ? formText(record.publicDescription) : (current.publicDescription ?? ""),
    internalNotes: "internalNotes" in record ? formText(record.internalNotes) : (current.internalNotes ?? ""),
    status: record.status ?? current.status,
    visibility: record.visibility ?? current.visibility,
    featured: record.featured ?? current.featured,
    isTicketed: record.isTicketed ?? current.isTicketed,
    ticketUrl: "ticketUrl" in record ? formText(record.ticketUrl) : (current.ticketUrl ?? ""),
    coverLabel: "coverLabel" in record ? formText(record.coverLabel) : (current.coverLabel ?? ""),
    artistIds: record.artistIds ?? current.artists.map((artist) => artist.id),
  };

  const finished = finishForm(formInput);
  if (!finished.ok) return finished;

  const columnPatch: EventColumnPatch = {};
  if ("title" in record) columnPatch.title = finished.fields.title;
  if ("publicDescription" in record) columnPatch.public_description = finished.fields.public_description;
  if ("internalNotes" in record) columnPatch.internal_notes = finished.fields.internal_notes;
  if ("eventType" in record) columnPatch.event_type = finished.fields.event_type;
  if ("startDate" in record || "startTime" in record) columnPatch.starts_at = finished.fields.starts_at;
  if ("endDate" in record || "endTime" in record) columnPatch.ends_at = finished.fields.ends_at;
  if ("locationLabel" in record) columnPatch.location_label = finished.fields.location_label;
  if ("status" in record) columnPatch.status = finished.fields.status;
  if ("visibility" in record) columnPatch.visibility = finished.fields.visibility;
  if ("featured" in record) columnPatch.featured = finished.fields.featured;
  if ("isTicketed" in record) columnPatch.is_ticketed = finished.fields.is_ticketed;
  if ("ticketUrl" in record) columnPatch.ticket_url = finished.fields.ticket_url;
  if ("coverLabel" in record) columnPatch.cover_label = finished.fields.cover_label;
  if ("archived" in record) columnPatch.archived = record.archived as boolean;

  return {
    ok: true,
    values: finished.values,
    columnPatch,
    replaceArtists: "artistIds" in record,
    artistIds: finished.artistIds,
  };
}

export function parseListBounds(from: string | null, to: string | null):
  | { ok: true; fromIso: string | null; toIso: string | null }
  | ContractFailure {
  const fromIso = parseBound(from, false);
  const toIso = parseBound(to, true);
  const fieldErrors: Record<string, string[]> = {};
  if (fromIso === "invalid") fieldErrors.from = ["Use a venue-local YYYY-MM-DD date or an ISO timestamp."];
  if (toIso === "invalid") fieldErrors.to = ["Use a venue-local YYYY-MM-DD date or an ISO timestamp."];
  if (Object.keys(fieldErrors).length > 0) return failure("Check the highlighted fields.", fieldErrors);
  if (fromIso && toIso && Date.parse(fromIso) > Date.parse(toIso)) {
    return failure("Check the highlighted fields.", { to: ["The end of the range is before the start."] });
  }
  return { ok: true, fromIso, toIso };
}

function parseBound(value: string | null, endOfDay: boolean): string | null | "invalid" {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    if (endOfDay) {
      const local = DateTime.fromISO(`${value}T23:59:59.999`, { zone: DEFAULT_VENUE_TIMEZONE });
      const iso = local.isValid ? local.toUTC().toISO() : null;
      return iso ?? "invalid";
    }
    const parsed = parseVenueLocalDateTime(value, "00:00", DEFAULT_VENUE_TIMEZONE);
    return parsed.ok ? parsed.iso : "invalid";
  }
  const instant = DateTime.fromISO(value, { setZone: true });
  if (!instant.isValid) return "invalid";
  return instant.toUTC().toISO();
}

function finishForm(formInput: Record<string, unknown>): ParsedCreate | ContractFailure {
  const parsed = eventFormSchema.safeParse(formInput);
  if (!parsed.success) {
    return failure("Check the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }
  if (new Set(parsed.data.artistIds).size !== parsed.data.artistIds.length) {
    return failure("Check the highlighted fields.", { artistIds: ["Artist ids must be unique."] });
  }
  if (parsed.data.artistIds.length > 20) {
    return failure("Check the highlighted fields.", { artistIds: ["Attach 20 artists or fewer."] });
  }
  const built = eventWriteFieldsFromForm(parsed.data);
  if (!built.ok) {
    const key = /end/i.test(built.message) ? "endTime" : "startTime";
    return failure(built.message, { [key]: [built.message] });
  }
  const canonical = canonicalCreateBody(parsed.data);
  return {
    ok: true,
    values: parsed.data,
    fields: built.fields,
    artistIds: parsed.data.artistIds,
    requestHash: hashCreatePayload(canonical),
  };
}

function canonicalCreateBody(values: EventFormValues) {
  return {
    title: values.title,
    eventType: values.eventType,
    startDate: values.startDate,
    startTime: values.startTime,
    endDate: values.endDate,
    endTime: values.endTime,
    timeZone: values.timeZone,
    locationLabel: values.locationLabel,
    publicDescription: values.publicDescription,
    internalNotes: values.internalNotes,
    status: values.status,
    visibility: values.visibility,
    featured: values.featured,
    isTicketed: values.isTicketed,
    ticketUrl: values.ticketUrl,
    coverLabel: values.coverLabel,
    artistIds: values.artistIds,
  };
}

function asRecord(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  return body as Record<string, unknown>;
}

function rejectUnknownFields(record: Record<string, unknown>, allowed: readonly string[]) {
  const fieldErrors: Record<string, string[]> = {};
  const protectedFields: readonly string[] = INTEGRATION_PROTECTED_FIELDS;
  for (const key of Object.keys(record)) {
    if (allowed.includes(key)) continue;
    fieldErrors[key] = [
      protectedFields.includes(key)
        ? "This field is protected and cannot be changed by the integration."
        : "This field is not writable.",
    ];
  }
  return Object.keys(fieldErrors).length > 0 ? fieldErrors : null;
}

function rejectEmptyNullable(record: Record<string, unknown>) {
  const fieldErrors: Record<string, string[]> = {};
  for (const key of NULLABLE_TEXT_FIELDS) {
    if (record[key] === "") fieldErrors[key] = ["Send null to clear this field, or omit it."];
  }
  return Object.keys(fieldErrors).length > 0 ? fieldErrors : null;
}

function rejectNullOnRequired(record: Record<string, unknown>) {
  const fieldErrors: Record<string, string[]> = {};
  const nullable = new Set<string>([...NULLABLE_TEXT_FIELDS, "artistIds"]);
  for (const [key, value] of Object.entries(record)) {
    if (value === null && !nullable.has(key)) fieldErrors[key] = ["This field cannot be null."];
  }
  if (record.artistIds === null) fieldErrors.artistIds = ["Send an empty array to remove artists."];
  return Object.keys(fieldErrors).length > 0 ? fieldErrors : null;
}

function formText(value: unknown) {
  if (value === undefined || value === null) return "";
  return value;
}

function timeZoneError(value: unknown) {
  if (value !== DEFAULT_VENUE_TIMEZONE) {
    return `Times must use ${DEFAULT_VENUE_TIMEZONE}.`;
  }
  return null;
}

function failure(message: string, fieldErrors: Record<string, string[]>): ContractFailure {
  return { ok: false, message, fieldErrors };
}

function fieldErrorsFromZod(error: z.ZodError) {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "form";
    fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
  }
  return fieldErrors;
}

export const INTEGRATION_EVENT_WRITE_COLUMNS = EVENT_WRITE_COLUMNS;
