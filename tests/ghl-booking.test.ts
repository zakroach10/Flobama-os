import { afterEach, describe, expect, it } from "vitest";
import { getGhlConfig, isGhlConfigured } from "@/lib/env";
import { ghlConfigured, searchRecords, updateRecord, type GhlDeps } from "@/lib/ghl/client";
import {
  applyLinkedContact,
  buildSearchRecordsBody,
  buildUpdateRecordBody,
  extractRecords,
  extractSchemas,
  mapRecordToBooking,
  resolveFieldMap,
  resolveSchemaKey,
  type GhlObjectSchema,
} from "@/lib/ghl/objects";
import { getGhlConnectionStatus, loadBookingDetail, loadBookingInbox, updateBookingFields } from "@/lib/ghl/booking";
import {
  extractRelations,
  loadLinkedContact,
  mapContactFields,
  resolveLinkedContactId,
  unwrapContact,
} from "@/lib/ghl/contacts";

const SAMPLE_SCHEMAS: GhlObjectSchema[] = [
  {
    key: "custom_objects.band_inquiries",
    labels: { singular: "Band Submission", plural: "Band Submissions" },
    fields: [
      { key: "artist_band_name", name: "Artist / band name", dataType: "TEXT" },
      { key: "booking_status", name: "Status", dataType: "DROPDOWN", options: ["New", "Reviewing", "Booked"] },
      { key: "internal_notes", name: "Internal notes", dataType: "LARGE_TEXT" },
    ],
  },
  {
    key: "custom_objects.private_events",
    labels: { singular: "Private events", plural: "Private events" },
    fields: [{ key: "name", name: "Name" }, { key: "status", name: "Stage", options: ["Inquiry", "Held"] }],
  },
];

const ENV_KEYS = [
  "GHL_PRIVATE_TOKEN",
  "GHL_LOCATION_ID",
  "GHL_API_VERSION",
  "GHL_OBJECT_BAND_SUBMISSION",
  "GHL_OBJECT_PRIVATE_EVENTS",
] as const;

const originalEnv: Record<string, string | undefined> = {};
for (const key of ENV_KEYS) originalEnv[key] = process.env[key];

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function configuredDeps(fetchImpl: typeof fetch): GhlDeps {
  return {
    config: {
      token: "pit_test",
      locationId: "loc_1",
      apiVersion: "2021-07-28",
      objectKeys: {},
    },
    fetchImpl,
  };
}

describe("ghl configuration", () => {
  it("is off when token or location is missing", () => {
    delete process.env.GHL_PRIVATE_TOKEN;
    delete process.env.GHL_LOCATION_ID;
    expect(getGhlConfig()).toBeNull();
    expect(isGhlConfigured()).toBe(false);
    expect(ghlConfigured(null)).toBe(false);
  });

  it("reads server-only env and optional overrides", () => {
    process.env.GHL_PRIVATE_TOKEN = "pit_abc";
    process.env.GHL_LOCATION_ID = "loc_xyz";
    process.env.GHL_OBJECT_BAND_SUBMISSION = "custom_objects.bands";
    const config = getGhlConfig();
    expect(config?.locationId).toBe("loc_xyz");
    expect(config?.apiVersion).toBe("2021-07-28");
    expect(config?.objectKeys.bandSubmission).toBe("custom_objects.bands");
    expect(isGhlConfigured()).toBe(true);
  });
});

describe("object discovery", () => {
  it("matches Band Submission and Private events labels case-insensitively", () => {
    const band = resolveSchemaKey(
      [{ key: "custom_objects.bands", labels: { singular: "band submissions" } }],
      "band_submission",
    );
    const events = resolveSchemaKey(
      [{ key: "custom_objects.pe", labels: { plural: "Private Events" } }],
      "private_events",
    );
    expect(band).toEqual({ key: "custom_objects.bands", schema: expect.any(Object), matchedBy: "label" });
    expect(events?.key).toBe("custom_objects.pe");
  });

  it("prefers an env override when labels do not match", () => {
    const resolved = resolveSchemaKey(SAMPLE_SCHEMAS, "band_submission", "custom_objects.other");
    expect(resolved).toEqual({ key: "custom_objects.other", schema: null, matchedBy: "override" });
  });

  it("uses custom_objects.band_inquiries for Band submissions when labels differ", () => {
    const byKey = resolveSchemaKey(
      [{ key: "custom_objects.band_inquiries", labels: { singular: "Something else" } }],
      "band_submission",
    );
    expect(byKey).toEqual({
      key: "custom_objects.band_inquiries",
      schema: expect.any(Object),
      matchedBy: "key",
    });
    const fallback = resolveSchemaKey([{ key: "custom_objects.unrelated", labels: { singular: "Other" } }], "band_submission");
    expect(fallback).toEqual({ key: "custom_objects.band_inquiries", schema: null, matchedBy: "key" });
  });

  it("extracts schemas from a list payload", () => {
    expect(extractSchemas({ objects: SAMPLE_SCHEMAS })).toHaveLength(2);
  });
});

describe("record mapping", () => {
  it("maps Band inquiry fields and leaves contact empty until relations hydrate", () => {
    const fieldMap = resolveFieldMap(SAMPLE_SCHEMAS[0], "band_submission");
    const booking = mapRecordToBooking(
      {
        id: "rec_1",
        name: "GHL Record",
        updatedAt: "2026-09-15T18:00:00.000Z",
        properties: {
          name: "GHL Record",
          "custom_objects.band_inquiries.artist_band_name": "The River Band",
          "custom_objects.band_inquiries.genre": "Americana",
          "custom_objects.band_inquiries.home_city__state": "Mobile, AL",
          "custom_objects.band_inquiries.available_dates": "Oct 3–4",
          "custom_objects.band_inquiries.expected_compensation": "$1,200",
          "custom_objects.band_inquiries.instagram": "@rivertown",
          booking_status: { value: "New" },
          internal_notes: "Follow up Friday",
        },
      },
      "custom_objects.band_inquiries",
      fieldMap,
      "band_submission",
    );
    expect(booking.displayName).toBe("The River Band");
    expect(booking.contactName).toBeNull();
    expect(booking.email).toBeNull();
    expect(booking.phone).toBeNull();
    expect(booking.contactLinkStatus).toBe("none");
    expect(booking.compensation).toBe("$1,200");
    expect(booking.requestedDates).toBe("Oct 3–4");
    expect(booking.inquiry?.genre).toBe("Americana");
    expect(booking.status).toBe("New");
  });
});

describe("linked contact relations", () => {
  it("resolves the contact id from association relations without treating the record id as a contact", () => {
    const resolved = resolveLinkedContactId(
      [
        {
          id: "rel_1",
          firstObjectKey: "custom_objects.band_inquiries",
          firstRecordId: "rec_band_1",
          secondObjectKey: "contact",
          secondObjectLabel: "Primary Contact",
          secondRecordId: "contact_known_1",
        },
      ],
      "rec_band_1",
    );
    expect(resolved).toEqual({ contactId: "contact_known_1", relationshipLabel: "Primary Contact" });
  });

  it("prefers the intended contact relationship label when multiple contacts are linked", () => {
    const resolved = resolveLinkedContactId(
      [
        {
          firstObjectKey: "custom_objects.band_inquiries",
          firstRecordId: "rec_band_1",
          secondObjectKey: "contact",
          secondObjectLabel: "Venue Manager",
          secondRecordId: "contact_other",
        },
        {
          firstObjectKey: "custom_objects.band_inquiries",
          firstRecordId: "rec_band_1",
          secondObjectKey: "contact",
          secondObjectLabel: "Primary Contact",
          secondRecordId: "contact_primary",
        },
      ],
      "rec_band_1",
    );
    expect(resolved).toEqual({ contactId: "contact_primary", relationshipLabel: "Primary Contact" });
  });

  it("maps contact.firstName, lastName, phone, and email", () => {
    expect(
      mapContactFields({
        firstName: "Alex",
        lastName: "Rivera",
        email: "alex@example.com",
        phone: "2515550100",
      }),
    ).toEqual({ name: "Alex Rivera", email: "alex@example.com", phone: "2515550100" });
    expect(unwrapContact({ contact: { id: "c1", firstName: "Alex" } })?.id).toBe("c1");
    expect(extractRelations({ relations: [{ id: "r1" }] })).toHaveLength(1);
  });

  it("fetches relations with pagination, then loads the linked contact for a known record", async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("/associations/relations/rec_band_1") && url.includes("skip=0")) {
        expect(url).toContain("locationId=loc_1");
        expect(url).toContain("limit=100");
        return jsonResponse({
          relations: Array.from({ length: 100 }, (_, index) => ({
            id: `rel_page1_${index}`,
            firstObjectKey: "custom_objects.band_inquiries",
            firstRecordId: "rec_band_1",
            secondObjectKey: "business",
            secondRecordId: `biz_${index}`,
          })),
        });
      }
      if (url.includes("/associations/relations/rec_band_1") && url.includes("skip=100")) {
        return jsonResponse({
          relations: [
            {
              id: "rel_contact",
              firstObjectKey: "custom_objects.band_inquiries",
              firstRecordId: "rec_band_1",
              secondObjectKey: "contact",
              secondObjectLabel: "Contact",
              secondRecordId: "contact_known_1",
            },
          ],
        });
      }
      if (url.includes("/contacts/contact_known_1")) {
        return jsonResponse({
          contact: {
            id: "contact_known_1",
            firstName: "Alex",
            lastName: "Rivera",
            email: "alex@example.com",
            phone: "2515550100",
          },
        });
      }
      return jsonResponse({ message: `unhandled ${url}` }, 500);
    };

    const linked = await loadLinkedContact("rec_band_1", configuredDeps(fetchImpl));
    expect(linked).toEqual({
      status: "linked",
      contactId: "contact_known_1",
      name: "Alex Rivera",
      email: "alex@example.com",
      phone: "2515550100",
      relationshipLabel: "Contact",
      message: null,
    });
    expect(calls.some((url) => url.includes("skip=0"))).toBe(true);
    expect(calls.some((url) => url.includes("skip=100"))).toBe(true);
    expect(calls.some((url) => url.includes("/contacts/contact_known_1"))).toBe(true);
  });

  it("returns No linked contact when relations exist but none are contacts", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("/associations/relations/rec_band_2")) {
        return jsonResponse({
          relations: [
            {
              firstObjectKey: "custom_objects.band_inquiries",
              firstRecordId: "rec_band_2",
              secondObjectKey: "opportunity",
              secondRecordId: "opp_1",
            },
          ],
        });
      }
      return jsonResponse({ message: `unhandled ${url}` }, 500);
    };
    const linked = await loadLinkedContact("rec_band_2", configuredDeps(fetchImpl));
    expect(linked.status).toBe("none");
    expect(linked.message).toBe("No linked contact");
  });

  it("distinguishes a failed contact lookup from no relationship", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("/associations/relations/rec_band_3")) {
        return jsonResponse({
          relations: [
            {
              firstObjectKey: "custom_objects.band_inquiries",
              firstRecordId: "rec_band_3",
              secondObjectKey: "contact",
              secondObjectLabel: "Contact",
              secondRecordId: "contact_missing",
            },
          ],
        });
      }
      if (url.includes("/contacts/contact_missing")) {
        return jsonResponse({ message: "Contact not found" }, 404);
      }
      return jsonResponse({ message: `unhandled ${url}` }, 500);
    };
    const linked = await loadLinkedContact("rec_band_3", configuredDeps(fetchImpl));
    expect(linked.status).toBe("error");
    expect(linked.message).toMatch(/not found|failed/i);
  });
});

describe("search and update payloads", () => {
  it("builds a one-page search body", () => {
    expect(buildSearchRecordsBody({ locationId: "loc_1", query: "river", page: 1 })).toEqual({
      locationId: "loc_1",
      page: 1,
      pageLimit: 50,
      query: "river",
    });
  });

  it("builds a status PUT body without extra stores", () => {
    expect(buildUpdateRecordBody("loc_1", { booking_status: "Booked" })).toEqual({
      locationId: "loc_1",
      properties: { booking_status: "Booked" },
    });
  });
});

describe("booking inbox and detail with linked contacts", () => {
  it("does not call the network when unconfigured", async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new Error("network should not run");
    };
    const result = await loadBookingInbox("band_submission", {}, { config: null, fetchImpl });
    expect(result).toEqual({ configured: false });
    const status = await getGhlConnectionStatus({ config: null, fetchImpl });
    expect(status.configured).toBe(false);
  });

  it("hydrates a known linked contact on inbox and detail", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.includes("/objects/") && url.includes("locationId=loc_1") && !url.includes("/records")) {
        return jsonResponse({ objects: SAMPLE_SCHEMAS });
      }
      if (url.includes("/records/search")) {
        return jsonResponse({
          records: [
            {
              id: "rec_band_1",
              updatedAt: "2026-09-15T18:00:00.000Z",
              properties: {
                artist_band_name: "The River Band",
                booking_status: "New",
              },
            },
          ],
        });
      }
      if (url.includes("/objects/custom_objects.band_inquiries/records/rec_band_1") && (init?.method ?? "GET") === "GET") {
        return jsonResponse({
          record: {
            id: "rec_band_1",
            updatedAt: "2026-09-15T18:00:00.000Z",
            properties: { artist_band_name: "The River Band", booking_status: "New" },
          },
        });
      }
      if (url.includes("/associations/relations/rec_band_1")) {
        return jsonResponse({
          relations: [
            {
              firstObjectKey: "custom_objects.band_inquiries",
              firstRecordId: "rec_band_1",
              secondObjectKey: "contact",
              secondObjectLabel: "Primary Contact",
              secondRecordId: "contact_known_1",
            },
          ],
        });
      }
      if (url.includes("/contacts/contact_known_1")) {
        return jsonResponse({
          contact: {
            id: "contact_known_1",
            firstName: "Alex",
            lastName: "Rivera",
            email: "alex@example.com",
            phone: "2515550100",
          },
        });
      }
      if (url.includes("/records/rec_band_1") && (init?.method === "PUT" || init?.method === "put")) {
        return jsonResponse({ id: "rec_band_1" });
      }
      return jsonResponse({ message: `unhandled ${url}` }, 500);
    };

    const deps = configuredDeps(fetchImpl);
    const inbox = await loadBookingInbox("band_submission", {}, deps);
    expect(inbox.configured).toBe(true);
    if (!inbox.configured) throw new Error("expected configured");
    expect(inbox.records[0]?.displayName).toBe("The River Band");
    expect(inbox.records[0]?.contactName).toBe("Alex Rivera");
    expect(inbox.records[0]?.email).toBe("alex@example.com");
    expect(inbox.records[0]?.phone).toBe("2515550100");
    expect(inbox.records[0]?.contactLinkStatus).toBe("linked");

    const detail = await loadBookingDetail("band_submission", "rec_band_1", deps);
    expect(detail.configured).toBe(true);
    if (!detail.configured || !detail.record) throw new Error("expected detail record");
    expect(detail.record.contactId).toBe("contact_known_1");
    expect(detail.record.contactName).toBe("Alex Rivera");
    expect(detail.record.email).toBe("alex@example.com");
    expect(detail.record.phone).toBe("2515550100");

    const updated = await updateBookingFields("band_submission", "rec_band_1", { status: "Booked" }, deps);
    expect(updated).toEqual({ ok: true });
  });

  it("applies No linked contact distinctly from a failed lookup", () => {
    const base = mapRecordToBooking(
      { id: "rec_x", properties: { artist_band_name: "Solo Act" } },
      "custom_objects.band_inquiries",
      resolveFieldMap(SAMPLE_SCHEMAS[0], "band_submission"),
      "band_submission",
    );
    const none = applyLinkedContact(base, {
      status: "none",
      contactId: null,
      name: null,
      email: null,
      phone: null,
      relationshipLabel: null,
      message: "No linked contact",
    });
    const failed = applyLinkedContact(base, {
      status: "error",
      contactId: "contact_x",
      name: null,
      email: null,
      phone: null,
      relationshipLabel: "Contact",
      message: "Linked contact lookup failed.",
    });
    expect(none.contactLinkStatus).toBe("none");
    expect(none.contactLinkMessage).toBe("No linked contact");
    expect(failed.contactLinkStatus).toBe("error");
    expect(failed.contactLinkMessage).toBe("Linked contact lookup failed.");
  });

  it("posts a search through the client helper", async () => {
    const fetchImpl: typeof fetch = async (_input, init) => {
      expect(init?.method).toBe("POST");
      return jsonResponse({ records: [] });
    };
    const payload = await searchRecords(
      "custom_objects.band_inquiries",
      { locationId: "loc_1", page: 1, pageLimit: 50, query: "" },
      configuredDeps(fetchImpl),
    );
    expect(extractRecords(payload)).toEqual([]);
  });

  it("PUTs record properties through the client helper", async () => {
    const fetchImpl: typeof fetch = async (_input, init) => {
      expect(init?.method).toBe("PUT");
      expect(JSON.parse(String(init?.body))).toEqual({ locationId: "loc_1", properties: { booking_status: "Held" } });
      return jsonResponse({ ok: true });
    };
    await updateRecord("custom_objects.band_inquiries", "rec_9", { booking_status: "Held" }, configuredDeps(fetchImpl));
  });
});
