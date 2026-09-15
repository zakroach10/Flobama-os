import type { GhlConfig } from "@/lib/env";
import {
  BAND_INQUIRY_DISPLAY_KEYS,
  buildBandInquiryView,
  inquiryProperty,
  type BandInquiryView,
} from "@/lib/ghl/band-inquiry";
import type { LinkedContact, LinkedContactStatus } from "@/lib/ghl/contacts";

export const BOOKING_KINDS = ["band_submission", "private_events"] as const;
export type BookingKind = (typeof BOOKING_KINDS)[number];

export const BOOKING_KIND_META: Record<
  BookingKind,
  {
    title: string;
    plural: string;
    href: string;
    envKey: keyof GhlConfig["objectKeys"];
    aliases: string[];
    knownKeys: string[];
  }
> = {
  band_submission: {
    title: "Band Submission",
    plural: "Band submissions",
    href: "/booking/submissions",
    envKey: "bandSubmission",
    aliases: ["band submission", "band submissions", "band inquiry", "band inquiries"],
    knownKeys: ["custom_objects.band_inquiries"],
  },
  private_events: {
    title: "Private events",
    plural: "Private events",
    href: "/booking/private-events",
    envKey: "privateEvents",
    aliases: ["private events", "private event"],
    knownKeys: [],
  },
};

export type SchemaMatchBy = "override" | "label" | "key";

export type GhlField = {
  key?: string;
  id?: string;
  name?: string;
  label?: string;
  dataType?: string;
  type?: string;
  options?: unknown;
};

export type GhlObjectSchema = {
  id?: string;
  key?: string;
  objectKey?: string;
  schemaKey?: string;
  name?: string;
  label?: string;
  labels?: { singular?: string; plural?: string };
  fields?: GhlField[];
  properties?: GhlField[] | Record<string, GhlField>;
  object?: GhlObjectSchema;
};

export type FieldRole = "displayName" | "email" | "phone" | "date" | "status" | "notes";

const ROLE_ALIASES: Record<FieldRole, string[]> = {
  displayName: [
    "name",
    "display name",
    "primary name",
    "title",
    "band name",
    "band",
    "artist",
    "artist name",
    "event name",
    "company name",
    "contact name",
  ],
  email: ["email", "email address", "contact email"],
  phone: ["phone", "phone number", "mobile", "contact phone"],
  date: ["date", "event date", "requested date", "preferred date", "show date", "requested dates", "dates"],
  status: ["status", "stage", "pipeline stage", "booking status"],
  notes: ["notes", "internal notes", "note", "comments", "staff notes"],
};

const BAND_NAME_ALIASES = ["artist_band_name", "artist band name", "band name", "band_name", "band", "artist name", "artist"];

export type BookingRecord = {
  id: string;
  schemaKey: string;
  displayName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  contactId: string | null;
  contactLinkStatus: LinkedContactStatus;
  contactLinkMessage: string | null;
  requestedDates: string | null;
  compensation: string | null;
  status: string | null;
  notes: string | null;
  updatedAt: string | null;
  createdAt: string | null;
  properties: Record<string, string | null>;
  statusOptions: string[];
  statusFieldKey: string | null;
  notesFieldKey: string | null;
  inquiry: BandInquiryView | null;
};

export function extractSchemas(payload: unknown): GhlObjectSchema[] {
  if (Array.isArray(payload)) return payload as GhlObjectSchema[];
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  for (const key of ["objects", "customObjects", "data", "schemas"]) {
    if (Array.isArray(record[key])) return record[key] as GhlObjectSchema[];
  }
  if (record.object && typeof record.object === "object") return [record.object as GhlObjectSchema];
  return [];
}

export function unwrapSchema(payload: unknown): GhlObjectSchema | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (record.object && typeof record.object === "object") return record.object as GhlObjectSchema;
  return payload as GhlObjectSchema;
}

export function schemaKeyOf(schema: GhlObjectSchema): string | null {
  const key = schema.key ?? schema.objectKey ?? schema.schemaKey ?? schema.id;
  return typeof key === "string" && key.trim() ? key.trim() : null;
}

export function schemaLabelOf(schema: GhlObjectSchema): string {
  return (
    schema.labels?.singular ||
    schema.labels?.plural ||
    schema.label ||
    schema.name ||
    schemaKeyOf(schema) ||
    ""
  );
}

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

export function labelsMatchKind(label: string, kind: BookingKind): boolean {
  const normalized = normalizeLabel(label);
  return BOOKING_KIND_META[kind].aliases.some((alias) => normalizeLabel(alias) === normalized);
}

export function resolveSchemaKey(
  schemas: GhlObjectSchema[],
  kind: BookingKind,
  override?: string | null,
): { key: string; schema: GhlObjectSchema | null; matchedBy: SchemaMatchBy } | null {
  const trimmedOverride = override?.trim();
  if (trimmedOverride) {
    const schema =
      schemas.find((item) => schemaKeyOf(item)?.toLowerCase() === trimmedOverride.toLowerCase()) ?? null;
    return { key: trimmedOverride, schema, matchedBy: "override" };
  }

  const match = schemas.find((schema) => {
    const key = schemaKeyOf(schema);
    if (key && BOOKING_KIND_META[kind].knownKeys.some((known) => known.toLowerCase() === key.toLowerCase())) {
      return true;
    }
    const labels = [schema.labels?.singular, schema.labels?.plural, schema.label, schema.name].filter(
      (value): value is string => Boolean(value),
    );
    return labels.some((label) => labelsMatchKind(label, kind));
  });
  if (match) {
    const key = schemaKeyOf(match);
    if (key) {
      const byKnownKey = BOOKING_KIND_META[kind].knownKeys.some((known) => known.toLowerCase() === key.toLowerCase());
      return { key, schema: match, matchedBy: byKnownKey ? "key" : "label" };
    }
  }

  const knownKey = BOOKING_KIND_META[kind].knownKeys[0];
  if (knownKey) {
    return { key: knownKey, schema: null, matchedBy: "key" };
  }
  return null;
}

export function schemaFields(schema: GhlObjectSchema | null | undefined): GhlField[] {
  if (!schema) return [];
  if (Array.isArray(schema.fields)) return schema.fields;
  if (Array.isArray(schema.properties)) return schema.properties;
  if (schema.properties && typeof schema.properties === "object") {
    return Object.entries(schema.properties).map(([key, field]) => ({
      ...field,
      key: field.key ?? key,
    }));
  }
  return [];
}

export function fieldKeyOf(field: GhlField): string | null {
  const key = field.key ?? field.id;
  return typeof key === "string" && key.trim() ? key.trim() : null;
}

export function fieldLabelOf(field: GhlField): string {
  return field.name || field.label || fieldKeyOf(field) || "";
}

function fieldTypeOf(field: GhlField): string {
  return (field.dataType || field.type || "").toLowerCase();
}

export function fieldOptions(field: GhlField | undefined): string[] {
  if (!field?.options) return [];
  const raw = field.options;
  if (!Array.isArray(raw)) return [];
  const values: string[] = [];
  for (const option of raw) {
    if (typeof option === "string" && option.trim()) values.push(option.trim());
    else if (option && typeof option === "object") {
      const record = option as Record<string, unknown>;
      const value = record.value ?? record.label ?? record.name;
      if (typeof value === "string" && value.trim()) values.push(value.trim());
    }
  }
  return [...new Set(values)];
}

function roleAliases(role: FieldRole, kind?: BookingKind): string[] {
  if (role === "displayName" && kind === "band_submission") return BAND_NAME_ALIASES;
  return ROLE_ALIASES[role];
}

export function resolveFieldMap(
  schema: GhlObjectSchema | null | undefined,
  kind?: BookingKind,
): Partial<Record<FieldRole, GhlField>> {
  const fields = schemaFields(schema);
  const map: Partial<Record<FieldRole, GhlField>> = {};
  for (const role of Object.keys(ROLE_ALIASES) as FieldRole[]) {
    const aliases = roleAliases(role, kind);
    const match = fields.find((field) => {
      const label = normalizeLabel(fieldLabelOf(field));
      const key = normalizeLabel(fieldKeyOf(field) ?? "");
      const segment = lastSegment(fieldKeyOf(field) ?? "");
      return aliases.some(
        (alias) => label === alias || key === alias || segment === alias || label.endsWith(` ${alias}`),
      );
    });
    if (match) map[role] = match;
  }
  if (!map.displayName && kind !== "band_submission") {
    const named = fields.find((field) => lastSegment(fieldKeyOf(field) ?? "") === "name");
    if (named) map.displayName = named;
  }
  if (!map.status) {
    const select = fields.find((field) => {
      const type = fieldTypeOf(field);
      return (type.includes("dropdown") || type.includes("select") || type.includes("radio")) && fieldOptions(field).length > 0;
    });
    if (select) map.status = select;
  }
  if (!map.notes) {
    const large = fields.find((field) => {
      const type = fieldTypeOf(field);
      const label = normalizeLabel(fieldLabelOf(field));
      return type.includes("large_text") || type.includes("textarea") || label.includes("note");
    });
    if (large) map.notes = large;
  }
  return map;
}

export function unwrapRecordPayload(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (record.record && typeof record.record === "object") return record.record as Record<string, unknown>;
  if (record.id || record.recordId || record.properties) return record;
  return record;
}

export function extractRecords(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  for (const key of ["records", "data", "results"]) {
    if (Array.isArray(record[key])) return record[key] as Record<string, unknown>[];
  }
  const single = unwrapRecordPayload(payload);
  return single ? [single] : [];
}

export function propertyValue(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
    const value = String(raw).trim();
    return value || null;
  }
  if (Array.isArray(raw)) {
    const joined = raw.map(propertyValue).filter(Boolean).join(", ");
    return joined || null;
  }
  if (typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    if ("value" in record) return propertyValue(record.value);
    if ("values" in record) return propertyValue(record.values);
  }
  return null;
}

export function recordProperties(record: Record<string, unknown>): Record<string, string | null> {
  const raw = record.properties;
  const out: Record<string, string | null> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    out[key] = propertyValue(value);
  }
  return out;
}

function lastSegment(key: string): string {
  const parts = key.split(".");
  return normalizeLabel(parts[parts.length - 1] ?? key);
}

function isGenericGhlName(value: string, recordId: string): boolean {
  const normalized = normalizeLabel(value);
  return (
    !normalized ||
    normalized === normalizeLabel(recordId) ||
    normalized === "ghl record" ||
    normalized === "gohighlevel record" ||
    normalized === "untitled"
  );
}

function pickProperty(
  properties: Record<string, string | null>,
  field: GhlField | undefined,
  fallbackKeys: string[],
): string | null {
  const key = field ? fieldKeyOf(field) : null;
  if (key && properties[key]) return properties[key];
  for (const fallback of fallbackKeys) {
    const wanted = normalizeLabel(fallback);
    const match = Object.entries(properties).find(([propKey]) => {
      const label = normalizeLabel(propKey);
      return label === wanted || lastSegment(propKey) === wanted;
    });
    if (match?.[1]) return match[1];
  }
  return null;
}

function pickDisplayName(
  kind: BookingKind | undefined,
  record: Record<string, unknown>,
  properties: Record<string, string | null>,
  fieldMap: Partial<Record<FieldRole, GhlField>>,
  recordId: string,
): string {
  const bandInquiry = kind === "band_submission";
  if (bandInquiry) {
    for (const key of BAND_INQUIRY_DISPLAY_KEYS) {
      const value = inquiryProperty(properties, { key, label: key, section: "profile" });
      if (value && !isGenericGhlName(value, recordId)) return value;
    }
  }
  const fallbacks = bandInquiry
    ? BAND_NAME_ALIASES
    : ["name", "display name", "title", "event name", "company name"];
  const fromField = pickProperty(properties, fieldMap.displayName, fallbacks);
  const fromRecordName = bandInquiry ? null : propertyValue(record.name);
  const value = fromField || fromRecordName;
  if (value && !isGenericGhlName(value, recordId)) return value;
  return bandInquiry ? "Untitled band" : recordId || "Untitled";
}

export function mapRecordToBooking(
  record: Record<string, unknown>,
  schemaKey: string,
  fieldMap: Partial<Record<FieldRole, GhlField>>,
  kind?: BookingKind,
): BookingRecord {
  const properties = recordProperties(record);
  const id = String(record.id ?? record.recordId ?? "");
  const inferredKind = kind ?? (schemaKey.includes("band_inquir") ? "band_submission" : undefined);
  const displayName = pickDisplayName(inferredKind, record, properties, fieldMap, id);
  const inquiry = inferredKind === "band_submission" ? buildBandInquiryView(record, properties) : null;
  const status = pickProperty(properties, fieldMap.status, ["status", "stage"]);
  const statusFieldKey = fieldMap.status ? fieldKeyOf(fieldMap.status) : null;
  const notesFieldKey = fieldMap.notes ? fieldKeyOf(fieldMap.notes) : null;
  const options = [...fieldOptions(fieldMap.status)];
  if (status && !options.includes(status)) options.unshift(status);

  return {
    id,
    schemaKey,
    displayName,
    contactName: null,
    email: null,
    phone: null,
    contactId: null,
    contactLinkStatus: "none",
    contactLinkMessage: null,
    requestedDates:
      inquiry?.availableDates ??
      pickProperty(properties, fieldMap.date, ["available_dates", "date", "event date", "requested date", "requested dates"]),
    compensation: inquiry?.compensation ?? null,
    status,
    notes: pickProperty(properties, fieldMap.notes, ["notes", "internal notes", "additional_information"]),
    updatedAt: propertyValue(record.updatedAt ?? record.dateUpdated ?? record.updated_at) ?? properties.updatedAt ?? null,
    createdAt: propertyValue(record.createdAt ?? record.dateAdded ?? record.created_at) ?? null,
    properties,
    statusOptions: options,
    statusFieldKey,
    notesFieldKey,
    inquiry,
  };
}

export function applyLinkedContact(record: BookingRecord, linked: LinkedContact): BookingRecord {
  const next: BookingRecord = {
    ...record,
    contactId: linked.contactId,
    contactLinkStatus: linked.status,
    contactLinkMessage: linked.message,
  };
  if (linked.status === "linked") {
    next.contactName = linked.name;
    next.email = linked.email;
    next.phone = linked.phone;
    if (next.inquiry) {
      next.inquiry = { ...next.inquiry, contactName: linked.name };
    }
  } else {
    next.contactName = null;
    next.email = null;
    next.phone = null;
    if (next.inquiry) {
      next.inquiry = { ...next.inquiry, contactName: null };
    }
  }
  return next;
}

export function buildSearchRecordsBody(input: {
  locationId: string;
  query?: string;
  page?: number;
  pageLimit?: number;
}): { locationId: string; page: number; pageLimit: number; query: string } {
  return {
    locationId: input.locationId,
    page: Math.max(1, input.page ?? 1),
    pageLimit: Math.min(100, Math.max(1, input.pageLimit ?? 50)),
    query: input.query?.trim() ?? "",
  };
}

export function buildUpdateRecordBody(locationId: string, properties: Record<string, string>) {
  return { locationId, properties };
}

export function ghlRecordUrl(locationId: string, schemaKey: string, recordId: string): string {
  return `https://app.gohighlevel.com/v2/location/${encodeURIComponent(locationId)}/custom-objects/${encodeURIComponent(schemaKey)}/${encodeURIComponent(recordId)}`;
}

export const REQUIRED_PIT_SCOPES = [
  "Custom object schema: read",
  "Custom object records: read",
  "Custom object records: write",
  "Associations / relations: read",
  "Contacts: read",
];
