import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { EVENT_WRITE_COLUMNS } from "@/lib/events/persist";
import { INTEGRATION_ARTWORK_IMAGE_MAX_BYTES } from "@/lib/events/artwork";
import {
  EVENT_STATUS_TRANSITIONS,
  integrationEventToPublic,
  type IntegrationEvent,
} from "@/lib/integrations/contract";
import { createIntegrationToken, hashIntegrationToken } from "@/lib/integrations/crypto";
import { redactSecrets } from "@/lib/integrations/http";
import { decideIdempotency, hashCreatePayload } from "@/lib/integrations/idempotency";
import { MemoryIntegrationStore, UnconfiguredIntegrationStore } from "@/lib/integrations/memory-store";
import {
  handleCompleteArtwork,
  handleCreateEvent,
  handleGetEvent,
  handleListArtists,
  handleListEvents,
  handlePatchEvent,
  handlePrepareArtwork,
  type IntegrationDeps,
} from "@/lib/integrations/service";
import { assertNoInternalFields } from "@/lib/public/listings";
import type { IntegrationScope } from "@/lib/integrations/contract";

const OTHER_VENUE_ID = "22222222-2222-4222-8222-222222222222";
const ARTIST_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_ARTIST_ID = "44444444-4444-4444-8444-444444444444";
const EXISTING_EVENT_ID = "55555555-5555-4555-8555-555555555555";
const OTHER_EVENT_ID = "66666666-6666-4666-8666-666666666666";

function harness(scopes: IntegrationScope[] = ["events:read", "events:write", "artists:read", "artwork:write"]) {
  const store = new MemoryIntegrationStore();
  const token = createIntegrationToken();
  const credentialId = "77777777-7777-4777-8777-777777777777";
  store.credentials.set(credentialId, {
    id: credentialId,
    venueId: FLO_BAMA_VENUE_ID,
    name: "HighLevel AI Studio",
    tokenHash: hashIntegrationToken(token),
    scopes,
    revokedAt: null,
  });
  store.artists.set(ARTIST_ID, {
    id: ARTIST_ID,
    venueId: FLO_BAMA_VENUE_ID,
    name: "The Steel Woods",
    genre: "country",
    archivedAt: null,
    artwork: null,
  });
  store.artists.set(OTHER_ARTIST_ID, {
    id: OTHER_ARTIST_ID,
    venueId: OTHER_VENUE_ID,
    name: "Other Room",
    genre: null,
    archivedAt: null,
    artwork: null,
  });
  store.events.set(EXISTING_EVENT_ID, {
    id: EXISTING_EVENT_ID,
    venueId: FLO_BAMA_VENUE_ID,
    title: "Already published",
    publicDescription: "Keep this status",
    internalNotes: "staff only",
    eventType: "live_music",
    startsAt: "2026-04-01T01:00:00.000Z",
    endsAt: "2026-04-01T04:00:00.000Z",
    locationLabel: "Main room",
    status: "published",
    visibility: "public",
    featured: false,
    archivedAt: null,
    isTicketed: false,
    ticketUrl: null,
    coverLabel: null,
    artistIds: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  store.events.set(OTHER_EVENT_ID, {
    id: OTHER_EVENT_ID,
    venueId: OTHER_VENUE_ID,
    title: "Other venue",
    publicDescription: null,
    internalNotes: null,
    eventType: "other",
    startsAt: "2026-04-02T01:00:00.000Z",
    endsAt: "2026-04-02T04:00:00.000Z",
    locationLabel: null,
    status: "published",
    visibility: "public",
    featured: false,
    archivedAt: null,
    isTicketed: false,
    ticketUrl: null,
    coverLabel: null,
    artistIds: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  const revalidated: string[] = [];
  const logs: string[] = [];
  const deps: IntegrationDeps = {
    store,
    revalidateEvent: (eventId) => {
      revalidated.push(eventId);
    },
    revalidateArtwork: (artistId) => {
      revalidated.push(`artwork:${artistId}`);
    },
    logError: (_requestId, error) => {
      logs.push(error instanceof Error ? error.message : String(error));
    },
    rateLimits: {
      credentialLimit: 120,
      credentialWindowSeconds: 60,
      ipLimit: 120,
      ipWindowSeconds: 60,
    },
  };
  return { store, token, credentialId, deps, revalidated, logs };
}

function request(path: string, token: string | null, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return new Request(`https://flobama-os.vercel.app${path}`, { ...init, headers });
}

function eventBody(overrides: Record<string, unknown> = {}) {
  return {
    title: "Late set",
    eventType: "live_music",
    startDate: "2026-06-12",
    startTime: "21:00",
    endDate: "2026-06-13",
    endTime: "01:30",
    status: "published",
    visibility: "public",
    artistIds: [ARTIST_ID],
    publicDescription: "Doors at 8.",
    internalNotes: "Load-in at 5.",
    ticketUrl: "https://tickets.example.test/late-set",
    isTicketed: true,
    coverLabel: "$10",
    locationLabel: "Main room",
    ...overrides,
  };
}

async function createEvent(env = harness(), body = eventBody(), key = "create-late-set-1") {
  const response = await handleCreateEvent(
    request("/api/integrations/v1/events", env.token, {
      method: "POST",
      headers: { "idempotency-key": key, "x-integration-actor": "studio-user-jane", "x-request-id": "req_create_1" },
      body: JSON.stringify(body),
    }),
    env.deps,
  );
  const payload = (await response.json()) as { event: IntegrationEvent; requestId: string; error?: { code: string; message: string; fieldErrors?: Record<string, string[]> } };
  return { response, payload, env };
}

describe("event integration contract", () => {
  it("treats the same normalized create body as one idempotency payload", () => {
    const withDefault = hashCreatePayload({ title: "A", featured: false });
    const reordered = hashCreatePayload({ featured: false, title: "A" });
    expect(withDefault).toBe(reordered);
    expect(hashCreatePayload({ title: "B", featured: false })).not.toBe(withDefault);
  });

  it("decides idempotency claims, replays, conflicts, and in-flight keys", () => {
    expect(decideIdempotency(null, "abc")).toBe("claim");
    expect(decideIdempotency({ requestHash: "abc", status: "completed" }, "abc")).toBe("replay");
    expect(decideIdempotency({ requestHash: "abc", status: "completed" }, "def")).toBe("conflict");
    expect(decideIdempotency({ requestHash: "abc", status: "pending" }, "abc")).toBe("in_progress");
  });

  it("allows the same status transitions the staff event actions allow", () => {
    for (const from of ["draft", "published", "cancelled"] as const) {
      expect(EVENT_STATUS_TRANSITIONS[from]).toEqual(["draft", "published", "cancelled"]);
    }
  });

  it("redacts integration tokens before logging", () => {
    const token = createIntegrationToken();
    expect(redactSecrets(`Bearer ${token} failed`)).not.toContain(token);
    expect(redactSecrets(`Bearer ${token} failed`)).toContain("[redacted-token]");
  });
});

describe("event integration API", () => {
  it("rejects missing, unknown, and revoked credentials", async () => {
    const env = harness();
    const missing = await handleListEvents(request("/api/integrations/v1/events", null), env.deps);
    expect(missing.status).toBe(401);
    const bad = await handleListEvents(request("/api/integrations/v1/events", `${createIntegrationToken()}extra`), env.deps);
    expect(bad.status).toBe(401);
    env.store.credentials.get(env.credentialId)!.revokedAt = "2026-01-02T00:00:00.000Z";
    const revoked = await handleListEvents(request("/api/integrations/v1/events", env.token), env.deps);
    expect(revoked.status).toBe(401);
    const body = await revoked.json();
    expect(body.error.code).toBe("unauthorized");
    expect(JSON.stringify(body)).not.toContain(env.token);
  });

  it("enforces scope and venue on reads and writes, including lookup by id", async () => {
    const reader = harness(["events:read"]);
    const denied = await handleCreateEvent(
      request("/api/integrations/v1/events", reader.token, {
        method: "POST",
        headers: { "idempotency-key": "reader-cannot-write" },
        body: JSON.stringify(eventBody()),
      }),
      reader.deps,
    );
    expect(denied.status).toBe(403);
    expect((await denied.json()).error.code).toBe("forbidden");

    const env = harness();
    const other = await handleGetEvent(request(`/api/integrations/v1/events/${OTHER_EVENT_ID}`, env.token), OTHER_EVENT_ID, env.deps);
    expect(other.status).toBe(404);
    const artists = await handleListArtists(request("/api/integrations/v1/artists?query=Other", env.token), env.deps);
    const artistBody = await artists.json();
    expect(artistBody.artists).toEqual([]);
    const wrongArtist = await handleCreateEvent(
      request("/api/integrations/v1/events", env.token, {
        method: "POST",
        headers: { "idempotency-key": "wrong-artist-1" },
        body: JSON.stringify(eventBody({ artistIds: [OTHER_ARTIST_ID], status: "draft" })),
      }),
      env.deps,
    );
    expect(wrongArtist.status).toBe(400);
    expect((await wrongArtist.json()).error.fieldErrors.artistIds[0]).toMatch(/venue/);
    expect(env.store.events.get(EXISTING_EVENT_ID)?.status).toBe("published");
  });

  it("creates an overnight Chicago event, lists it publicly, and keeps internal notes off the public feed", async () => {
    const { response, payload, env } = await createEvent();
    expect(response.status).toBe(201);
    expect(payload.requestId).toBe("req_create_1");
    expect(response.headers.get("cache-control")).toContain("no-store");
    const event = payload.event;
    expect(event.startsAt).toBe("2026-06-13T02:00:00.000Z");
    expect(event.endsAt).toBe("2026-06-13T06:30:00.000Z");
    expect(event.startDate).toBe("2026-06-12");
    expect(event.endDate).toBe("2026-06-13");
    expect(event.endTime).toBe("01:30");
    expect(event.timeZone).toBe("America/Chicago");
    expect(event.publiclyListed).toBe(true);
    expect(event.artists[0]).toMatchObject({ id: ARTIST_ID, name: "The Steel Woods" });
    expect(event.internalNotes).toBe("Load-in at 5.");
    const publicEvent = integrationEventToPublic(event);
    expect(publicEvent?.name).toBe("Late set");
    expect(publicEvent && assertNoInternalFields(publicEvent)).toBe(true);
    expect(JSON.stringify(publicEvent)).not.toMatch(/internal/i);
    expect(env.revalidated).toEqual([event.id]);
    const audit = env.store.audits.find((entry) => entry.action === "events.create" && entry.metadata?.replay !== true);
    expect(audit).toMatchObject({
      credentialId: env.credentialId,
      eventId: event.id,
      requestId: "req_create_1",
      reportedActor: "studio-user-jane",
    });

    const listed = await handleListEvents(
      request("/api/integrations/v1/events?from=2026-06-12&to=2026-06-12&status=published", env.token),
      env.deps,
    );
    const listBody = await listed.json();
    expect(listBody.events.map((item: IntegrationEvent) => item.id)).toContain(event.id);
    const draftHidden = await handleListEvents(
      request("/api/integrations/v1/events?status=draft", env.token),
      env.deps,
    );
    expect((await draftHidden.json()).events.map((item: IntegrationEvent) => item.id)).not.toContain(event.id);
  });

  it("rejects daylight-saving gaps and ambiguous fall-back times", async () => {
    const gap = await createEvent(harness(), eventBody({ startDate: "2026-03-08", startTime: "02:30", endDate: "2026-03-08", endTime: "04:00", status: "draft" }), "dst-gap-1");
    expect(gap.response.status).toBe(400);
    expect(gap.payload.error?.fieldErrors?.startTime?.[0]).toMatch(/daylight-saving/i);
    const overlap = await createEvent(
      harness(),
      eventBody({ startDate: "2025-11-02", startTime: "01:30", endDate: "2025-11-02", endTime: "03:00", status: "draft" }),
      "dst-overlap",
    );
    expect(overlap.response.status).toBe(400);
    expect(overlap.payload.error?.fieldErrors?.startTime?.[0]).toMatch(/ambiguous/i);
  });

  it("converts a winter Chicago start to UTC", async () => {
    const { payload, response } = await createEvent(
      harness(),
      eventBody({
        startDate: "2026-01-15",
        startTime: "20:00",
        endDate: "2026-01-15",
        endTime: "23:00",
        status: "draft",
        visibility: "private",
      }),
      "winter-show",
    );
    expect(response.status).toBe(201);
    expect(payload.event.startsAt).toBe("2026-01-16T02:00:00.000Z");
    expect(payload.event.publiclyListed).toBe(false);
    expect(integrationEventToPublic(payload.event)).toBeNull();
  });

  it("replays the original create and conflicts when the payload changes", async () => {
    const env = harness();
    const first = await createEvent(env, eventBody(), "idem-key-1");
    const second = await createEvent(env, eventBody({ featured: false }), "idem-key-1");
    expect(second.response.status).toBe(201);
    expect(second.payload.event.id).toBe(first.payload.event.id);
    expect(env.revalidated).toEqual([first.payload.event.id]);
    expect([...env.store.events.keys()].filter((id) => id !== EXISTING_EVENT_ID && id !== OTHER_EVENT_ID)).toHaveLength(1);

    const conflict = await createEvent(env, eventBody({ title: "Different title" }), "idem-key-1");
    expect(conflict.response.status).toBe(409);
    expect(conflict.payload.error?.code).toBe("idempotency_conflict");
    expect(env.store.events.get(first.payload.event.id)?.title).toBe("Late set");
  });

  it("does not consume an idempotency key when validation fails", async () => {
    const env = harness();
    const invalid = await createEvent(
      env,
      eventBody({ startDate: "2026-03-08", startTime: "02:30", endDate: "2026-03-08", endTime: "04:00" }),
      "retry-key",
    );
    expect(invalid.response.status).toBe(400);
    const created = await createEvent(env, eventBody({ status: "draft", visibility: "private" }), "retry-key");
    expect(created.response.status).toBe(201);
  });

  it("serializes concurrent creates that share an idempotency key", async () => {
    const env = harness();
    const headers = { "idempotency-key": "concurrent-same", "content-type": "application/json" };
    const body = JSON.stringify(eventBody({ title: "One show" }));
    const [left, right] = await Promise.all([
      handleCreateEvent(request("/api/integrations/v1/events", env.token, { method: "POST", headers, body }), env.deps),
      handleCreateEvent(request("/api/integrations/v1/events", env.token, { method: "POST", headers, body }), env.deps),
    ]);
    const [leftBody, rightBody] = await Promise.all([left.json(), right.json()]);
    expect([left.status, right.status]).toEqual([201, 201]);
    expect(leftBody.event.id).toBe(rightBody.event.id);
    expect([...env.store.events.values()].filter((event) => event.title === "One show")).toHaveLength(1);

    const otherHeaders = { "idempotency-key": "concurrent-diff", "content-type": "application/json" };
    const [winner, loser] = await Promise.all([
      handleCreateEvent(
        request("/api/integrations/v1/events", env.token, {
          method: "POST",
          headers: otherHeaders,
          body: JSON.stringify(eventBody({ title: "Winner" })),
        }),
        env.deps,
      ),
      handleCreateEvent(
        request("/api/integrations/v1/events", env.token, {
          method: "POST",
          headers: otherHeaders,
          body: JSON.stringify(eventBody({ title: "Loser" })),
        }),
        env.deps,
      ),
    ]);
    const statuses = [winner.status, loser.status].sort();
    expect(statuses).toEqual([201, 409]);
    expect([...env.store.events.values()].some((event) => event.title === "Loser")).toBe(false);
  });

  it("patches only the sent fields, clears nulls, and rejects stale edits", async () => {
    const env = harness();
    const created = await createEvent(env, eventBody({ status: "draft" }), "patch-base");
    const original = created.payload.event;
    const missingMatch = await handlePatchEvent(
      request(`/api/integrations/v1/events/${original.id}`, env.token, {
        method: "PATCH",
        body: JSON.stringify({ title: "Nope" }),
      }),
      original.id,
      env.deps,
    );
    expect(missingMatch.status).toBe(428);

    const cleared = await handlePatchEvent(
      request(`/api/integrations/v1/events/${original.id}`, env.token, {
        method: "PATCH",
        headers: { "if-match": original.updatedAt, "x-integration-actor": "studio-user-jane" },
        body: JSON.stringify({ publicDescription: null }),
      }),
      original.id,
      env.deps,
    );
    expect(cleared.status).toBe(200);
    const clearedBody = await cleared.json();
    expect(clearedBody.event.title).toBe("Late set");
    expect(clearedBody.event.publicDescription).toBeNull();
    expect(clearedBody.event.internalNotes).toBe("Load-in at 5.");

    const nullTitle = await handlePatchEvent(
      request(`/api/integrations/v1/events/${original.id}`, env.token, {
        method: "PATCH",
        headers: { "if-match": clearedBody.event.updatedAt },
        body: JSON.stringify({ title: null }),
      }),
      original.id,
      env.deps,
    );
    expect(nullTitle.status).toBe(400);
    expect(env.store.events.get(original.id)?.title).toBe("Late set");

    const protectedField = await handlePatchEvent(
      request(`/api/integrations/v1/events/${original.id}`, env.token, {
        method: "PATCH",
        headers: { "if-match": clearedBody.event.updatedAt },
        body: JSON.stringify({ venueId: OTHER_VENUE_ID }),
      }),
      original.id,
      env.deps,
    );
    expect(protectedField.status).toBe(400);
    expect((await protectedField.json()).error.fieldErrors.venueId[0]).toMatch(/protected/i);

    const stale = await handlePatchEvent(
      request(`/api/integrations/v1/events/${original.id}`, env.token, {
        method: "PATCH",
        headers: { "if-match": original.updatedAt },
        body: JSON.stringify({ title: "Stale title" }),
      }),
      original.id,
      env.deps,
    );
    expect(stale.status).toBe(409);
    const staleBody = await stale.json();
    expect(staleBody.error.code).toBe("edit_conflict");
    expect(staleBody.error.currentUpdatedAt).toBe(clearedBody.event.updatedAt);
    expect(env.store.events.get(original.id)?.title).toBe("Late set");

    const [first, second] = await Promise.all([
      handlePatchEvent(
        request(`/api/integrations/v1/events/${original.id}`, env.token, {
          method: "PATCH",
          headers: { "if-match": clearedBody.event.updatedAt },
          body: JSON.stringify({ title: "Title A", locationLabel: "Patio" }),
        }),
        original.id,
        env.deps,
      ),
      handlePatchEvent(
        request(`/api/integrations/v1/events/${original.id}`, env.token, {
          method: "PATCH",
          headers: { "if-match": clearedBody.event.updatedAt },
          body: JSON.stringify({ title: "Title B", coverLabel: "Free" }),
        }),
        original.id,
        env.deps,
      ),
    ]);
    const outcomes = [first.status, second.status].sort();
    expect(outcomes).toEqual([200, 409]);
    const saved = env.store.events.get(original.id)!;
    expect(["Title A", "Title B"]).toContain(saved.title);
    if (saved.title === "Title A") {
      expect(saved.locationLabel).toBe("Patio");
      expect(saved.coverLabel).toBe("$10");
    } else {
      expect(saved.coverLabel).toBe("Free");
      expect(saved.locationLabel).toBe("Main room");
    }
  });

  it("unpublishes through the existing lifecycle without deleting the row", async () => {
    const env = harness();
    const created = await createEvent(env, eventBody(), "lifecycle-1");
    const event = created.payload.event;
    expect(event.publiclyListed).toBe(true);
    const cancelled = await handlePatchEvent(
      request(`/api/integrations/v1/events/${event.id}`, env.token, {
        method: "PATCH",
        headers: { "if-match": event.updatedAt },
        body: JSON.stringify({ status: "cancelled" }),
      }),
      event.id,
      env.deps,
    );
    const cancelledBody = await cancelled.json();
    expect(cancelledBody.event.status).toBe("cancelled");
    expect(cancelledBody.event.publiclyListed).toBe(false);
    expect(integrationEventToPublic(cancelledBody.event)).toBeNull();

    const archived = await handlePatchEvent(
      request(`/api/integrations/v1/events/${event.id}`, env.token, {
        method: "PATCH",
        headers: { "if-match": cancelledBody.event.updatedAt },
        body: JSON.stringify({ archived: true }),
      }),
      event.id,
      env.deps,
    );
    const archivedBody = await archived.json();
    expect(archivedBody.event.archivedAt).toBeTruthy();
    expect(env.store.events.has(event.id)).toBe(true);
    const hidden = await handleListEvents(request("/api/integrations/v1/events", env.token), env.deps);
    expect((await hidden.json()).events.map((item: IntegrationEvent) => item.id)).not.toContain(event.id);
    const restored = await handlePatchEvent(
      request(`/api/integrations/v1/events/${event.id}`, env.token, {
        method: "PATCH",
        headers: { "if-match": archivedBody.event.updatedAt },
        body: JSON.stringify({ archived: false, status: "published", visibility: "public" }),
      }),
      event.id,
      env.deps,
    );
    expect((await restored.json()).event.publiclyListed).toBe(true);
    expect(env.store.events.get(EXISTING_EVENT_ID)?.status).toBe("published");
  });

  it("looks up artists in the credential venue and attaches artwork through a signed upload", async () => {
    const env = harness();
    const found = await handleListArtists(request("/api/integrations/v1/artists?query=Steel", env.token), env.deps);
    const artists = await found.json();
    expect(artists.artists).toEqual([
      expect.objectContaining({ id: ARTIST_ID, name: "The Steel Woods", artwork: null }),
    ]);

    const tooBig = await handlePrepareArtwork(
      request(`/api/integrations/v1/artists/${ARTIST_ID}/artwork/uploads`, env.token, {
        method: "POST",
        body: JSON.stringify({ contentType: "image/png", byteSize: INTEGRATION_ARTWORK_IMAGE_MAX_BYTES + 1 }),
      }),
      ARTIST_ID,
      env.deps,
    );
    expect(tooBig.status).toBe(400);

    const video = await handlePrepareArtwork(
      request(`/api/integrations/v1/artists/${ARTIST_ID}/artwork/uploads`, env.token, {
        method: "POST",
        body: JSON.stringify({ contentType: "video/mp4", byteSize: INTEGRATION_ARTWORK_IMAGE_MAX_BYTES + 1 }),
      }),
      ARTIST_ID,
      env.deps,
    );
    expect(video.status).toBe(200);

    const prepared = await handlePrepareArtwork(
      request(`/api/integrations/v1/artists/${ARTIST_ID}/artwork/uploads`, env.token, {
        method: "POST",
        body: JSON.stringify({ contentType: "image/png", byteSize: 1200 }),
      }),
      ARTIST_ID,
      env.deps,
    );
    expect(prepared.status).toBe(200);
    const upload = (await prepared.json()).upload;
    expect(upload.method).toBe("PUT");
    expect(upload.signedUrl).not.toMatch(/service_role/i);
    expect(upload.storagePath).toContain(`${FLO_BAMA_VENUE_ID}/led/artists/${ARTIST_ID}-`);

    const skipped = await handleCompleteArtwork(
      request(`/api/integrations/v1/artists/${ARTIST_ID}/artwork`, env.token, {
        method: "POST",
        body: JSON.stringify({ storagePath: `${FLO_BAMA_VENUE_ID}/led/artists/${ARTIST_ID}-not-uploaded.png`, contentType: "image/png" }),
      }),
      ARTIST_ID,
      env.deps,
    );
    expect(skipped.status).toBe(400);

    const saved = await handleCompleteArtwork(
      request(`/api/integrations/v1/artists/${ARTIST_ID}/artwork`, env.token, {
        method: "POST",
        body: JSON.stringify({ storagePath: upload.storagePath, contentType: "image/png" }),
      }),
      ARTIST_ID,
      env.deps,
    );
    expect(saved.status).toBe(200);
    expect((await saved.json()).artwork.publicUrl).toContain(upload.storagePath);
    expect(env.revalidated).toContain(`artwork:${ARTIST_ID}`);

    const created = await createEvent(env, eventBody({ status: "draft", visibility: "private" }), "with-art");
    expect(created.payload.event.artists[0]?.artwork?.publicUrl).toContain(upload.storagePath);
    const replay = await createEvent(env, eventBody({ status: "draft", visibility: "private" }), "with-art");
    expect(replay.payload.event.id).toBe(created.payload.event.id);
  });

  it("rate limits a credential and does not log the bearer token", async () => {
    const env = harness();
    env.deps.rateLimits = {
      credentialLimit: 2,
      credentialWindowSeconds: 60,
      ipLimit: 20,
      ipWindowSeconds: 60,
    };
    const first = await handleListEvents(request("/api/integrations/v1/events", env.token), env.deps);
    const second = await handleListEvents(request("/api/integrations/v1/events", env.token), env.deps);
    const third = await handleListEvents(request("/api/integrations/v1/events", env.token), env.deps);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(third.headers.get("retry-after")).toBeTruthy();
    expect((await third.json()).error.code).toBe("rate_limited");

    env.deps.rateLimits = {
      credentialLimit: 20,
      credentialWindowSeconds: 60,
      ipLimit: 20,
      ipWindowSeconds: 60,
    };
    env.store.listEvents = async () => {
      throw new Error(`database exploded for Bearer ${env.token}`);
    };
    const broken = await handleListEvents(request("/api/integrations/v1/events", env.token, { headers: { "x-request-id": "req_broken_1" } }), env.deps);
    expect(broken.status).toBe(500);
    const brokenBody = await broken.json();
    expect(JSON.stringify(brokenBody)).not.toContain(env.token);
    expect(brokenBody.error.message).toBe("The event integration could not complete this request.");
    expect(env.logs.join("\n")).toContain("[redacted-token]");
    expect(env.logs.join("\n")).not.toContain(env.token);
  });

  it("reports that storage is not configured without echoing secrets", async () => {
    const response = await handleListEvents(request("/api/integrations/v1/events", createIntegrationToken()), {
      store: new UnconfiguredIntegrationStore(),
    });
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("not_configured");
  });

  it("keeps the public route and migration scoped to the existing event columns", () => {
    const migration = readFileSync("supabase/migrations/20261103000063_event_integration.sql", "utf8");
    for (const column of EVENT_WRITE_COLUMNS) expect(migration).toContain(column);
    expect(migration).not.toMatch(/update\s+public\.events\s+set\s+status\s*=\s*'published'/i);
    const script = readFileSync("scripts/integration-credential.mjs", "utf8");
    expect(script).toContain("sha256");
    expect(script).toContain(FLO_BAMA_VENUE_ID);
    expect(script).not.toMatch(/fbint_[A-Za-z0-9_-]{20,}/);
    const eventsRoute = readFileSync("src/app/api/integrations/v1/events/route.ts", "utf8");
    const eventRoute = readFileSync("src/app/api/integrations/v1/events/[id]/route.ts", "utf8");
    expect(eventsRoute).toContain("handleListEvents");
    expect(eventsRoute).toContain("handleCreateEvent");
    expect(eventRoute).toContain("handleGetEvent");
    expect(eventRoute).toContain("handlePatchEvent");
    expect(eventRoute).not.toContain("DELETE");
    const publicRoute = readFileSync("src/app/api/public/v1/events/route.ts", "utf8");
    expect(publicRoute).not.toContain("integration");
  });
});
