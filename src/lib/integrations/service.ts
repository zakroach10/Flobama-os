import { z } from "zod";
import { EVENT_STATUSES, EVENT_VISIBILITIES, type EventStatus, type EventVisibility } from "@/lib/constants";
import {
  contentTypeMatchesArtworkPath,
  integrationArtworkSpec,
  isArtistArtworkStoragePath,
  type IntegrationArtworkContentType,
} from "@/lib/events/artwork";
import {
  parseCreateEvent,
  parseEventParts,
  parseListBounds,
  parsePatchEvent,
  toIntegrationEvent,
  type IntegrationScope,
} from "@/lib/integrations/contract";
import {
  hashIntegrationToken,
  integrationTokenMatches,
} from "@/lib/integrations/crypto";
import {
  INTEGRATION_RATE_LIMITS,
  clientIpKey,
  integrationError,
  integrationJson,
  readBearerToken,
  readIdempotencyKey,
  readIfMatch,
  readJsonBody,
  readReportedActor,
  readRequestId,
  redactSecrets,
  type IntegrationErrorCode,
} from "@/lib/integrations/http";
import { IntegrationNotReadyError } from "@/lib/integrations/supabase-store";
import type { IntegrationStore, RateLimitDecision, StoreFailure } from "@/lib/integrations/store";

const SIGNED_UPLOAD_EXPIRES_SECONDS = 7200;

export type IntegrationDeps = {
  store: IntegrationStore;
  now?: () => Date;
  revalidateEvent?: (eventId: string) => void;
  revalidateArtwork?: (artistId: string) => void;
  logError?: (requestId: string, error: unknown) => void;
  rateLimits?: typeof INTEGRATION_RATE_LIMITS;
};

type AuthContext = {
  requestId: string;
  credentialId: string;
  venueId: string;
  reportedActor: string | null;
  rate: RateLimitDecision;
};

export async function handleListEvents(request: Request, deps: IntegrationDeps) {
  const requestId = readRequestId(request);
  try {
    const auth = await authorize(request, deps, "events:read", requestId);
    if (auth instanceof Response) return auth;
    const url = new URL(request.url);
    const bounds = parseListBounds(url.searchParams.get("from"), url.searchParams.get("to"));
    if (!bounds.ok) return invalid(auth, bounds.message, bounds.fieldErrors);
    const statuses = parseStatuses(url.searchParams.get("status"));
    if (statuses === "invalid") {
      return invalid(auth, "Check the highlighted fields.", { status: ["Use draft, published, cancelled, or all."] });
    }
    const visibility = parseVisibility(url.searchParams.get("visibility"));
    if (visibility === "invalid") {
      return invalid(auth, "Check the highlighted fields.", { visibility: ["Use public or private."] });
    }
    const includeArchived = parseFlag(url.searchParams.get("includeArchived"));
    if (includeArchived === "invalid") {
      return invalid(auth, "Check the highlighted fields.", { includeArchived: ["Use 1 or 0."] });
    }
    const limit = parseLimit(url.searchParams.get("limit"), 50, 100);
    if (limit === "invalid") return invalid(auth, "Check the highlighted fields.", { limit: ["Use a limit from 1 to 100."] });
    const cursor = decodeCursor(url.searchParams.get("cursor"), "event");
    if (cursor === "invalid") return invalid(auth, "Check the highlighted fields.", { cursor: ["That page cursor is not valid."] });

    const listed = await deps.store.listEvents({
      credentialId: auth.credentialId,
      venueId: auth.venueId,
      fromIso: bounds.fromIso,
      toIso: bounds.toIso,
      statuses,
      visibility,
      includeArchived: includeArchived === true,
      limit: limit + 1,
      cursor,
      requestId: auth.requestId,
      reportedActor: auth.reportedActor,
    });
    if (!listed.ok) return fromStore(deps, auth, listed, "Event");
    const hasMore = listed.events.length > limit;
    const page = listed.events.slice(0, limit).map(requireEvent);
    const last = page[page.length - 1];
    return json(auth, {
      events: page,
      page: {
        limit,
        hasMore,
        nextCursor: hasMore && last ? encodeCursor({ startsAt: last.startsAt, id: last.id }) : null,
      },
    });
  } catch (error) {
    return failed(deps, requestId, error);
  }
}

export async function handleCreateEvent(request: Request, deps: IntegrationDeps) {
  const requestId = readRequestId(request);
  try {
    const auth = await authorize(request, deps, "events:write", requestId);
    if (auth instanceof Response) return auth;
    const key = readIdempotencyKey(request);
    if (!key.ok) {
      return integrationError(auth.requestId, "missing_idempotency_key", "POST requires an Idempotency-Key header.", {
        headers: rateHeaders(auth.rate),
      });
    }
    const body = await readJsonBody(request);
    if (!body.ok) return bodyError(auth, body.code);
    const parsed = parseCreateEvent(body.value);
    if (!parsed.ok) return invalid(auth, parsed.message, parsed.fieldErrors);
    const created = await deps.store.createEvent({
      credentialId: auth.credentialId,
      venueId: auth.venueId,
      idempotencyKey: key.value,
      requestHash: parsed.requestHash,
      fields: parsed.fields,
      artistIds: parsed.artistIds,
      requestId: auth.requestId,
      reportedActor: auth.reportedActor,
    });
    if (!created.ok) return fromStore(deps, auth, created, "Event");
    const event = requireEvent(created.parts);
    if (!created.replay) safeRevalidate(deps, auth.requestId, () => deps.revalidateEvent?.(event.id));
    return json(auth, { event }, 201);
  } catch (error) {
    return failed(deps, requestId, error);
  }
}

export async function handleGetEvent(request: Request, eventId: string, deps: IntegrationDeps) {
  const requestId = readRequestId(request);
  try {
    const auth = await authorize(request, deps, "events:read", requestId);
    if (auth instanceof Response) return auth;
    if (!z.string().uuid().safeParse(eventId).success) return missing(auth, "Event");
    const loaded = await deps.store.getEvent({
      credentialId: auth.credentialId,
      venueId: auth.venueId,
      eventId,
      requestId: auth.requestId,
      reportedActor: auth.reportedActor,
    });
    if (!loaded.ok) return fromStore(deps, auth, loaded, "Event");
    return json(auth, { event: requireEvent(loaded.parts) });
  } catch (error) {
    return failed(deps, requestId, error);
  }
}

export async function handlePatchEvent(request: Request, eventId: string, deps: IntegrationDeps) {
  const requestId = readRequestId(request);
  try {
    const auth = await authorize(request, deps, "events:write", requestId);
    if (auth instanceof Response) return auth;
    if (!z.string().uuid().safeParse(eventId).success) return missing(auth, "Event");
    const match = readIfMatch(request);
    if (!match.ok && match.missing) {
      return integrationError(
        auth.requestId,
        "precondition_required",
        "PATCH requires If-Match set to the event updatedAt value.",
        { headers: rateHeaders(auth.rate) },
      );
    }
    if (!match.ok) {
      return invalid(auth, "Check the highlighted fields.", {
        "If-Match": ["Send the updatedAt value from the event you are editing."],
      });
    }
    const body = await readJsonBody(request);
    if (!body.ok) return bodyError(auth, body.code);
    const currentResult = await deps.store.getEvent({
      credentialId: auth.credentialId,
      venueId: auth.venueId,
      eventId,
      requestId: auth.requestId,
      reportedActor: auth.reportedActor,
    });
    if (!currentResult.ok) return fromStore(deps, auth, currentResult, "Event");
    const current = requireEvent(currentResult.parts);
    const parsed = parsePatchEvent(body.value, current);
    if (!parsed.ok) return invalid(auth, parsed.message, parsed.fieldErrors);
    const updated = await deps.store.updateEvent({
      credentialId: auth.credentialId,
      venueId: auth.venueId,
      eventId,
      expectedUpdatedAt: match.value,
      columnPatch: parsed.columnPatch,
      replaceArtists: parsed.replaceArtists,
      artistIds: parsed.artistIds,
      requestId: auth.requestId,
      reportedActor: auth.reportedActor,
    });
    if (!updated.ok) return fromStore(deps, auth, updated, "Event");
    const event = requireEvent(updated.parts);
    safeRevalidate(deps, auth.requestId, () => deps.revalidateEvent?.(event.id));
    return json(auth, { event });
  } catch (error) {
    return failed(deps, requestId, error);
  }
}

export async function handleListArtists(request: Request, deps: IntegrationDeps) {
  const requestId = readRequestId(request);
  try {
    const auth = await authorize(request, deps, "artists:read", requestId);
    if (auth instanceof Response) return auth;
    const url = new URL(request.url);
    const query = url.searchParams.get("query")?.trim() ?? "";
    if (query && !/^[\p{L}\p{N} .&'’+-]{1,160}$/u.test(query)) {
      return invalid(auth, "Check the highlighted fields.", {
        query: ["Search by artist name using letters, numbers, spaces, and . & ' + -."],
      });
    }
    const limit = parseLimit(url.searchParams.get("limit"), 25, 50);
    if (limit === "invalid") return invalid(auth, "Check the highlighted fields.", { limit: ["Use a limit from 1 to 50."] });
    const cursor = decodeCursor(url.searchParams.get("cursor"), "artist");
    if (cursor === "invalid") return invalid(auth, "Check the highlighted fields.", { cursor: ["That page cursor is not valid."] });
    const listed = await deps.store.listArtists({
      credentialId: auth.credentialId,
      venueId: auth.venueId,
      query,
      limit: limit + 1,
      cursor,
      requestId: auth.requestId,
      reportedActor: auth.reportedActor,
    });
    if (!listed.ok) return fromStore(deps, auth, listed, "Artist");
    const hasMore = listed.artists.length > limit;
    const page = listed.artists.slice(0, limit);
    const last = page[page.length - 1];
    return json(auth, {
      artists: page,
      page: {
        limit,
        hasMore,
        nextCursor: hasMore && last ? encodeCursor({ name: last.name, id: last.id }) : null,
      },
    });
  } catch (error) {
    return failed(deps, requestId, error);
  }
}

export async function handlePrepareArtwork(request: Request, artistId: string, deps: IntegrationDeps) {
  const requestId = readRequestId(request);
  try {
    const auth = await authorize(request, deps, "artwork:write", requestId);
    if (auth instanceof Response) return auth;
    if (!z.string().uuid().safeParse(artistId).success) return missing(auth, "Artist");
    const body = await readJsonBody(request);
    if (!body.ok) return bodyError(auth, body.code);
    const parsed = parseArtworkPrepare(body.value);
    if (!parsed.ok) return invalid(auth, parsed.message, parsed.fieldErrors);
    const spec = integrationArtworkSpec(parsed.contentType);
    if (!spec || parsed.byteSize > spec.maxBytes) {
      return invalid(auth, "Check the highlighted fields.", {
        byteSize: [`Artwork must be ${spec ? spec.maxBytes : "within the allowed"} bytes or smaller for that file type.`],
      });
    }
    const prepared = await deps.store.prepareArtwork({
      credentialId: auth.credentialId,
      venueId: auth.venueId,
      artistId,
      contentType: parsed.contentType,
      byteSize: parsed.byteSize,
      extension: spec.ext,
      maxBytes: spec.maxBytes,
      requestId: auth.requestId,
      reportedActor: auth.reportedActor,
    });
    if (!prepared.ok) return fromStore(deps, auth, prepared, "Artist");
    return json(auth, {
      upload: {
        ...prepared.upload,
        method: "PUT",
        expiresInSeconds: SIGNED_UPLOAD_EXPIRES_SECONDS,
      },
    });
  } catch (error) {
    return failed(deps, requestId, error);
  }
}

export async function handleCompleteArtwork(request: Request, artistId: string, deps: IntegrationDeps) {
  const requestId = readRequestId(request);
  try {
    const auth = await authorize(request, deps, "artwork:write", requestId);
    if (auth instanceof Response) return auth;
    if (!z.string().uuid().safeParse(artistId).success) return missing(auth, "Artist");
    const body = await readJsonBody(request);
    if (!body.ok) return bodyError(auth, body.code);
    const parsed = parseArtworkComplete(body.value);
    if (!parsed.ok) return invalid(auth, parsed.message, parsed.fieldErrors);
    if (
      !isArtistArtworkStoragePath(auth.venueId, artistId, parsed.storagePath) ||
      !contentTypeMatchesArtworkPath(parsed.contentType, parsed.storagePath)
    ) {
      return invalid(auth, "Check the highlighted fields.", {
        storagePath: ["Use the storagePath returned by the artwork upload request for this artist."],
      });
    }
    const saved = await deps.store.completeArtwork({
      credentialId: auth.credentialId,
      venueId: auth.venueId,
      artistId,
      storagePath: parsed.storagePath,
      contentType: parsed.contentType,
      requestId: auth.requestId,
      reportedActor: auth.reportedActor,
    });
    if (!saved.ok) return fromStore(deps, auth, saved, "Artist");
    safeRevalidate(deps, auth.requestId, () => deps.revalidateArtwork?.(artistId));
    return json(auth, { artwork: saved.artwork });
  } catch (error) {
    return failed(deps, requestId, error);
  }
}

async function authorize(
  request: Request,
  deps: IntegrationDeps,
  scope: IntegrationScope,
  requestId: string,
): Promise<AuthContext | Response> {
  if (!deps.store.isConfigured()) {
    return integrationError(requestId, "not_configured", "Event integration storage is not configured.");
  }
  const limits = deps.rateLimits ?? INTEGRATION_RATE_LIMITS;
  const now = deps.now?.() ?? new Date();
  const ip = await deps.store.consumeRateLimit(clientIpKey(request), limits.ipLimit, limits.ipWindowSeconds, now);
  if (!ip.allowed) return rateLimited(requestId, ip);
  const token = readBearerToken(request);
  if (!token) return integrationError(requestId, "unauthorized", "Integration credential was missing or not recognized.");
  const credential = await deps.store.findCredentialByTokenHash(hashIntegrationToken(token));
  if (!credential || credential.revokedAt || !integrationTokenMatches(credential.tokenHash, token)) {
    return integrationError(requestId, "unauthorized", "Integration credential was missing or not recognized.");
  }
  void deps.store.touchCredential(credential.id, now.toISOString()).catch((error: unknown) => {
    log(deps, requestId, error);
  });
  const rate = await deps.store.consumeRateLimit(
    `cred:${credential.id}`,
    limits.credentialLimit,
    limits.credentialWindowSeconds,
    now,
  );
  if (!rate.allowed) {
    await deps.store.writeAudit({
      venueId: credential.venueId,
      credentialId: credential.id,
      action: "rate_limited",
      eventId: null,
      requestId,
      reportedActor: readReportedActor(request),
    });
    return rateLimited(requestId, rate);
  }
  if (!credential.scopes.includes(scope)) {
    await deps.store.writeAudit({
      venueId: credential.venueId,
      credentialId: credential.id,
      action: "forbidden",
      eventId: null,
      requestId,
      reportedActor: readReportedActor(request),
      metadata: { scope },
    });
    return integrationError(requestId, "forbidden", `This integration credential cannot perform ${scope}.`, {
      headers: rateHeaders(rate),
    });
  }
  return {
    requestId,
    credentialId: credential.id,
    venueId: credential.venueId,
    reportedActor: readReportedActor(request),
    rate,
  };
}

function requireEvent(parts: unknown) {
  const parsed = parseEventParts(parts);
  if (!parsed) throw new Error("Event snapshot did not match the integration contract.");
  return toIntegrationEvent(parsed);
}

function json(auth: AuthContext, body: Record<string, unknown>, status = 200) {
  return integrationJson({ ...body, requestId: auth.requestId }, status, auth.requestId, rateHeaders(auth.rate));
}

function invalid(auth: AuthContext, message: string, fieldErrors: Record<string, string[]>) {
  return integrationError(auth.requestId, "invalid_input", message, {
    fieldErrors,
    headers: rateHeaders(auth.rate),
  });
}

function missing(auth: AuthContext, noun: "Event" | "Artist") {
  return integrationError(auth.requestId, "not_found", `${noun} not found.`, { headers: rateHeaders(auth.rate) });
}

function bodyError(auth: AuthContext, code: IntegrationErrorCode) {
  const message =
    code === "invalid_json"
      ? "The request body is not valid JSON."
      : code === "payload_too_large"
        ? "The request body is too large."
        : "Send Content-Type: application/json.";
  return integrationError(auth.requestId, code, message, { headers: rateHeaders(auth.rate) });
}

function fromStore(deps: IntegrationDeps, auth: AuthContext, failure: StoreFailure, noun: "Event" | "Artist") {
  const headers = rateHeaders(auth.rate);
  if (failure.code === "not_found") return integrationError(auth.requestId, "not_found", `${noun} not found.`, { headers });
  if (failure.code === "forbidden") {
    return integrationError(auth.requestId, "forbidden", "This integration credential cannot perform that action.", { headers });
  }
  if (failure.code === "invalid_artists") {
    return integrationError(auth.requestId, "invalid_input", "Check the highlighted fields.", {
      fieldErrors: { artistIds: ["One or more artists do not belong to this venue."] },
      headers,
    });
  }
  if (failure.code === "invalid_input") {
    return integrationError(auth.requestId, "invalid_input", failure.message ?? "Check the highlighted fields.", { headers });
  }
  if (failure.code === "idempotency_conflict") {
    return integrationError(
      auth.requestId,
      "idempotency_conflict",
      "This Idempotency-Key was already used with a different request body.",
      { headers },
    );
  }
  if (failure.code === "idempotency_in_progress") {
    return integrationError(
      auth.requestId,
      "idempotency_in_progress",
      "This Idempotency-Key is already being processed. Retry the same request.",
      { headers },
    );
  }
  if (failure.code === "edit_conflict") {
    return integrationError(
      auth.requestId,
      "edit_conflict",
      "This event was updated after you loaded it. Reload the event and try again.",
      { currentUpdatedAt: failure.currentUpdatedAt, headers },
    );
  }
  if (failure.code === "not_ready") {
    return integrationError(auth.requestId, "not_configured", "Event integration storage is not ready.");
  }
  if (failure.logMessage) log(deps, auth.requestId, new Error(failure.logMessage));
  return integrationError(auth.requestId, "server_error", "The event integration could not complete this request.", { headers });
}

function rateLimited(requestId: string, decision: RateLimitDecision) {
  return integrationError(requestId, "rate_limited", "Too many requests. Try again later.", {
    headers: {
      ...rateHeaders(decision),
      "retry-after": String(decision.retryAfterSeconds),
    },
  });
}

function rateHeaders(decision: RateLimitDecision) {
  return {
    "x-ratelimit-limit": String(decision.limit),
    "x-ratelimit-remaining": String(decision.remaining),
  };
}

function failed(deps: IntegrationDeps, requestId: string, error: unknown) {
  if (error instanceof IntegrationNotReadyError) {
    return integrationError(requestId, "not_configured", "Event integration storage is not ready.");
  }
  log(deps, requestId, error);
  return integrationError(requestId, "server_error", "The event integration could not complete this request.");
}

function safeRevalidate(deps: IntegrationDeps, requestId: string, run: () => void) {
  try {
    run();
  } catch (error) {
    log(deps, requestId, error);
  }
}

function log(deps: Pick<IntegrationDeps, "logError">, requestId: string, error: unknown) {
  const message = error instanceof Error ? error.message : "unknown error";
  const safe = redactSecrets(message);
  if (deps.logError) deps.logError(requestId, new Error(safe));
  else console.error(JSON.stringify({ source: "event-integration", requestId, message: safe }));
}

function parseStatuses(raw: string | null): EventStatus[] | null | "invalid" {
  if (!raw || raw === "all") return null;
  const parts = raw.split(",").map((item) => item.trim()).filter(Boolean);
  if (parts.length === 0 || parts.some((item) => !(EVENT_STATUSES as readonly string[]).includes(item))) return "invalid";
  return [...new Set(parts)] as EventStatus[];
}

function parseVisibility(raw: string | null): EventVisibility | null | "invalid" {
  if (!raw) return null;
  if (!(EVENT_VISIBILITIES as readonly string[]).includes(raw)) return "invalid";
  return raw as EventVisibility;
}

function parseFlag(raw: string | null) {
  if (!raw || raw === "0" || raw === "false") return false;
  if (raw === "1" || raw === "true") return true;
  return "invalid" as const;
}

function parseLimit(raw: string | null, fallback: number, max: number) {
  if (!raw) return fallback;
  if (!/^\d+$/.test(raw)) return "invalid" as const;
  const value = Number(raw);
  if (value < 1 || value > max) return "invalid" as const;
  return value;
}

function encodeCursor(value: Record<string, string>) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeCursor(raw: string | null, kind: "event"): { startsAt: string; id: string } | null | "invalid";
function decodeCursor(raw: string | null, kind: "artist"): { name: string; id: string } | null | "invalid";
function decodeCursor(
  raw: string | null,
  kind: "event" | "artist",
): { startsAt: string; id: string } | { name: string; id: string } | null | "invalid" {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Record<string, unknown>;
    if (kind === "event") {
      if (typeof parsed.startsAt !== "string" || Number.isNaN(Date.parse(parsed.startsAt))) return "invalid" as const;
      if (typeof parsed.id !== "string" || !z.string().uuid().safeParse(parsed.id).success) return "invalid" as const;
      return { startsAt: parsed.startsAt, id: parsed.id };
    }
    if (typeof parsed.name !== "string" || !parsed.name.trim()) return "invalid" as const;
    if (typeof parsed.id !== "string" || !z.string().uuid().safeParse(parsed.id).success) return "invalid" as const;
    return { name: parsed.name, id: parsed.id };
  } catch {
    return "invalid" as const;
  }
}

function parseArtworkPrepare(body: unknown):
  | { ok: true; contentType: IntegrationArtworkContentType; byteSize: number }
  | { ok: false; message: string; fieldErrors: Record<string, string[]> } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, message: "Send a JSON object.", fieldErrors: { form: ["Send a JSON object."] } };
  }
  const record = body as Record<string, unknown>;
  const extra = Object.keys(record).filter((key) => key !== "contentType" && key !== "byteSize");
  if (extra.length > 0) {
    return {
      ok: false,
      message: "One or more fields cannot be set by this integration.",
      fieldErrors: Object.fromEntries(extra.map((key) => [key, ["This field is not writable."]])),
    };
  }
  const spec = typeof record.contentType === "string" ? integrationArtworkSpec(record.contentType) : null;
  const fieldErrors: Record<string, string[]> = {};
  if (!spec) fieldErrors.contentType = ["Use image/png, image/jpeg, image/heic, image/heif, or video/mp4."];
  if (typeof record.byteSize !== "number" || !Number.isInteger(record.byteSize) || record.byteSize < 1) {
    fieldErrors.byteSize = ["Send the file size in bytes."];
  }
  if (Object.keys(fieldErrors).length > 0) return { ok: false, message: "Check the highlighted fields.", fieldErrors };
  return { ok: true, contentType: record.contentType as IntegrationArtworkContentType, byteSize: record.byteSize as number };
}

function parseArtworkComplete(body: unknown):
  | { ok: true; storagePath: string; contentType: string }
  | { ok: false; message: string; fieldErrors: Record<string, string[]> } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, message: "Send a JSON object.", fieldErrors: { form: ["Send a JSON object."] } };
  }
  const record = body as Record<string, unknown>;
  const allowed = new Set(["storagePath", "contentType"]);
  const extra = Object.keys(record).filter((key) => !allowed.has(key));
  if (extra.length > 0) {
    return {
      ok: false,
      message: "One or more fields cannot be set by this integration.",
      fieldErrors: Object.fromEntries(
        extra.map((key) => [key, [key === "publicUrl" ? "This field is protected and cannot be changed by the integration." : "This field is not writable."]]),
      ),
    };
  }
  const fieldErrors: Record<string, string[]> = {};
  if (typeof record.storagePath !== "string" || !record.storagePath.trim()) fieldErrors.storagePath = ["storagePath is required."];
  if (typeof record.contentType !== "string" || !integrationArtworkSpec(record.contentType)) {
    fieldErrors.contentType = ["Use image/png, image/jpeg, image/heic, image/heif, or video/mp4."];
  }
  if (Object.keys(fieldErrors).length > 0) return { ok: false, message: "Check the highlighted fields.", fieldErrors };
  return { ok: true, storagePath: record.storagePath as string, contentType: record.contentType as string };
}
