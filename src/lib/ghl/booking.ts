import type { GhlConfig } from "@/lib/env";
import {
  ghlConfigured,
  getObjectSchema,
  getRecord,
  listObjectSchemas,
  resolveGhlConfig,
  searchRecords,
  updateRecord,
  type GhlDeps,
} from "@/lib/ghl/client";
import {
  BOOKING_KIND_META,
  buildSearchRecordsBody,
  extractRecords,
  extractSchemas,
  ghlRecordUrl,
  mapRecordToBooking,
  REQUIRED_PIT_SCOPES,
  fieldKeyOf,
  resolveFieldMap,
  resolveSchemaKey,
  unwrapSchema,
  type BookingKind,
  type BookingRecord,
  type GhlObjectSchema,
} from "@/lib/ghl/objects";

export type BookingInboxResult =
  | { configured: false }
  | {
      configured: true;
      schemaKey: string | null;
      matchedBy: "override" | "label" | null;
      records: BookingRecord[];
      statusOptions: string[];
      error?: string;
    };

export type BookingDetailResult =
  | { configured: false }
  | { configured: true; record: null; error: string }
  | { configured: true; record: BookingRecord; openInGhl: string; error?: string };

export type GhlConnectionStatus = {
  configured: boolean;
  locationId: string | null;
  apiVersion: string | null;
  objects: { kind: BookingKind; title: string; key: string | null; matchedBy: "override" | "label" | null }[];
  discoveredLabels: string[];
  requiredScopes: string[];
  error?: string;
};

async function loadSchemas(deps?: GhlDeps): Promise<GhlObjectSchema[]> {
  const payload = await listObjectSchemas(deps);
  return extractSchemas(payload);
}

async function loadSchema(schemas: GhlObjectSchema[], kind: BookingKind, config: GhlConfig, deps?: GhlDeps) {
  const resolved = resolveSchemaKey(schemas, kind, config.objectKeys[BOOKING_KIND_META[kind].envKey]);
  if (!resolved) return null;
  if (resolved.schema && (resolved.schema.fields || resolved.schema.properties)) return resolved;
  try {
    const detailed = unwrapSchema(await getObjectSchema(resolved.key, deps));
    return { ...resolved, schema: detailed ?? resolved.schema };
  } catch {
    return resolved;
  }
}

export async function loadBookingInbox(
  kind: BookingKind,
  filters: { query?: string; status?: string; page?: number },
  deps?: GhlDeps,
): Promise<BookingInboxResult> {
  const config = resolveGhlConfig(deps);
  if (!ghlConfigured(config)) return { configured: false };

  try {
    const schemas = await loadSchemas({ ...deps, config });
    const resolved = await loadSchema(schemas, kind, config, { ...deps, config });
    if (!resolved) {
      return {
        configured: true,
        schemaKey: null,
        matchedBy: null,
        records: [],
        statusOptions: [],
        error: `Could not find a custom object labeled “${BOOKING_KIND_META[kind].title}”. Set ${kind === "band_submission" ? "GHL_OBJECT_BAND_SUBMISSION" : "GHL_OBJECT_PRIVATE_EVENTS"} if the schema key differs.`,
      };
    }

    const body = buildSearchRecordsBody({
      locationId: config.locationId,
      query: filters.query,
      page: filters.page,
    });
    const payload = await searchRecords(resolved.key, body, { ...deps, config });
    const fieldMap = resolveFieldMap(resolved.schema);
    let records = extractRecords(payload)
      .map((record) => mapRecordToBooking(record, resolved.key, fieldMap))
      .filter((record) => record.id);
    records.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));

    const statusFilter = filters.status?.trim();
    if (statusFilter && statusFilter !== "all") {
      records = records.filter((record) => (record.status ?? "") === statusFilter);
    }

    const statusOptions = [...new Set(records.flatMap((record) => record.statusOptions.concat(record.status ? [record.status] : [])))];
    return {
      configured: true,
      schemaKey: resolved.key,
      matchedBy: resolved.matchedBy,
      records,
      statusOptions,
    };
  } catch (error) {
    return {
      configured: true,
      schemaKey: null,
      matchedBy: null,
      records: [],
      statusOptions: [],
      error: error instanceof Error ? error.message : "Could not load GoHighLevel records.",
    };
  }
}

export async function loadBookingDetail(kind: BookingKind, recordId: string, deps?: GhlDeps): Promise<BookingDetailResult> {
  const config = resolveGhlConfig(deps);
  if (!ghlConfigured(config)) return { configured: false };

  try {
    const schemas = await loadSchemas({ ...deps, config });
    const resolved = await loadSchema(schemas, kind, config, { ...deps, config });
    if (!resolved) {
      return { configured: true, record: null, error: `Custom object “${BOOKING_KIND_META[kind].title}” was not found.` };
    }
    const payload = await getRecord(resolved.key, recordId, { ...deps, config });
    const raw = extractRecords(payload)[0];
    if (!raw) return { configured: true, record: null, error: "That record was not found in GoHighLevel." };
    const record = mapRecordToBooking(raw, resolved.key, resolveFieldMap(resolved.schema));
    return {
      configured: true,
      record,
      openInGhl: ghlRecordUrl(config.locationId, resolved.key, record.id),
    };
  } catch (error) {
    return {
      configured: true,
      record: null,
      error: error instanceof Error ? error.message : "Could not load that GoHighLevel record.",
    };
  }
}

export async function updateBookingFields(
  kind: BookingKind,
  recordId: string,
  patch: { status?: string; notes?: string },
  deps?: GhlDeps,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const config = resolveGhlConfig(deps);
  if (!ghlConfigured(config)) return { ok: false, message: "GoHighLevel is not configured." };

  try {
    const schemas = await loadSchemas({ ...deps, config });
    const resolved = await loadSchema(schemas, kind, config, { ...deps, config });
    if (!resolved) return { ok: false, message: `Custom object “${BOOKING_KIND_META[kind].title}” was not found.` };
    const fieldMap = resolveFieldMap(resolved.schema);
    const properties: Record<string, string> = {};
    if (patch.status !== undefined) {
      const key = fieldKeyOf(fieldMap.status ?? {});
      if (!key) return { ok: false, message: "This object has no status or stage field to update." };
      properties[key] = patch.status;
    }
    if (patch.notes !== undefined) {
      const key = fieldKeyOf(fieldMap.notes ?? {});
      if (!key) return { ok: false, message: "This object has no notes field in GoHighLevel." };
      properties[key] = patch.notes;
    }
    if (Object.keys(properties).length === 0) return { ok: false, message: "Nothing to update." };
    await updateRecord(resolved.key, recordId, properties, { ...deps, config });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not update GoHighLevel." };
  }
}

export async function getGhlConnectionStatus(deps?: GhlDeps): Promise<GhlConnectionStatus> {
  const config = resolveGhlConfig(deps);
  if (!ghlConfigured(config)) {
    return {
      configured: false,
      locationId: null,
      apiVersion: null,
      objects: [
        { kind: "band_submission", title: BOOKING_KIND_META.band_submission.title, key: null, matchedBy: null },
        { kind: "private_events", title: BOOKING_KIND_META.private_events.title, key: null, matchedBy: null },
      ],
      discoveredLabels: [],
      requiredScopes: REQUIRED_PIT_SCOPES,
    };
  }

  try {
    const schemas = await loadSchemas({ ...deps, config });
    const objects = (["band_submission", "private_events"] as BookingKind[]).map((kind) => {
      const resolved = resolveSchemaKey(schemas, kind, config.objectKeys[BOOKING_KIND_META[kind].envKey]);
      return {
        kind,
        title: BOOKING_KIND_META[kind].title,
        key: resolved?.key ?? null,
        matchedBy: resolved?.matchedBy ?? null,
      };
    });
    return {
      configured: true,
      locationId: config.locationId,
      apiVersion: config.apiVersion,
      objects,
      discoveredLabels: schemas.map((schema) => schema.labels?.singular || schema.labels?.plural || schema.name || schema.key || "").filter(Boolean),
      requiredScopes: REQUIRED_PIT_SCOPES,
    };
  } catch (error) {
    return {
      configured: true,
      locationId: config.locationId,
      apiVersion: config.apiVersion,
      objects: [
        { kind: "band_submission", title: BOOKING_KIND_META.band_submission.title, key: null, matchedBy: null },
        { kind: "private_events", title: BOOKING_KIND_META.private_events.title, key: null, matchedBy: null },
      ],
      discoveredLabels: [],
      requiredScopes: REQUIRED_PIT_SCOPES,
      error: error instanceof Error ? error.message : "Could not list GoHighLevel objects.",
    };
  }
}
