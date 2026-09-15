import { afterEach, describe, expect, it } from "vitest";
import { getGhlConfig, isGhlConfigured } from "@/lib/env";
import { ghlConfigured, searchRecords, updateRecord, type GhlDeps } from "@/lib/ghl/client";
import {
  buildSearchRecordsBody,
  buildUpdateRecordBody,
  extractRecords,
  extractSchemas,
  mapRecordToBooking,
  resolveFieldMap,
  resolveSchemaKey,
  type GhlObjectSchema,
} from "@/lib/ghl/objects";
import { getGhlConnectionStatus, loadBookingInbox, updateBookingFields } from "@/lib/ghl/booking";

const SAMPLE_SCHEMAS: GhlObjectSchema[] = [
  {
    key: "custom_objects.band_submission",
    labels: { singular: "Band Submission", plural: "Band Submissions" },
    fields: [
      { key: "band_name", name: "Band name", dataType: "TEXT" },
      { key: "email", name: "Email", dataType: "TEXT" },
      { key: "phone", name: "Phone", dataType: "PHONE" },
      { key: "requested_date", name: "Requested date", dataType: "DATE" },
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
  it("maps Band inquiries from contact and custom object keys", () => {
    const fieldMap = resolveFieldMap(SAMPLE_SCHEMAS[0], "band_submission");
    const booking = mapRecordToBooking(
      {
        id: "rec_1",
        name: "GHL Record",
        updatedAt: "2026-09-15T18:00:00.000Z",
        contact: { full_name: "Alex Rivera", email: "alex@example.com", phone: "2515550100" },
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
    expect(booking.contactName).toBe("Alex Rivera");
    expect(booking.email).toBe("alex@example.com");
    expect(booking.phone).toBe("2515550100");
    expect(booking.compensation).toBe("$1,200");
    expect(booking.requestedDates).toBe("Oct 3–4");
    expect(booking.inquiry?.genre).toBe("Americana");
    expect(booking.inquiry?.homeCity).toBe("Mobile, AL");
    expect(booking.inquiry?.fields.find((field) => field.key === "instagram")?.href).toBe("https://instagram.com/rivertown");
    expect(booking.status).toBe("New");
    expect(booking.statusFieldKey).toBe("booking_status");
    expect(booking.notesFieldKey).toBe("internal_notes");
    expect(booking.statusOptions).toEqual(["New", "Reviewing", "Booked"]);
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

describe("booking inbox with mocked fetch", () => {
  it("does not call the network when unconfigured", async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new Error("network should not run");
    };
    const result = await loadBookingInbox("band_submission", {}, { config: null, fetchImpl });
    expect(result).toEqual({ configured: false });
    const status = await getGhlConnectionStatus({ config: null, fetchImpl });
    expect(status.configured).toBe(false);
  });

  it("discovers the object, lists one page, and writes a status PUT", async () => {
    const calls: { url: string; method: string; body: string | null; headers: Headers }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push({
        url,
        method: init?.method ?? "GET",
        body: typeof init?.body === "string" ? init.body : null,
        headers: new Headers(init?.headers),
      });
      if (url.includes("/objects/") && url.endsWith("/objects/?locationId=loc_1")) {
        return jsonResponse({ objects: SAMPLE_SCHEMAS });
      }
      if (url.includes("/records/search")) {
        expect(JSON.parse(init?.body as string)).toMatchObject({ locationId: "loc_1", page: 1, query: "" });
        return jsonResponse({
          records: [
            {
              id: "rec_1",
              updatedAt: "2026-09-15T18:00:00.000Z",
              properties: { band_name: "The River Band", booking_status: "New", email: "band@example.com" },
            },
          ],
        });
      }
      if (url.includes("/records/rec_1") && (init?.method === "PUT" || init?.method === "put")) {
        expect(JSON.parse(init.body as string)).toEqual({
          locationId: "loc_1",
          properties: { booking_status: "Booked" },
        });
        return jsonResponse({ id: "rec_1" });
      }
      if (url.includes("/objects/custom_objects.band_submission")) {
        return jsonResponse({ object: SAMPLE_SCHEMAS[0] });
      }
      return jsonResponse({ message: `unhandled ${url}` }, 500);
    };

    const deps = configuredDeps(fetchImpl);
    const inbox = await loadBookingInbox("band_submission", {}, deps);
    expect(inbox.configured).toBe(true);
    if (!inbox.configured) throw new Error("expected configured");
    expect(inbox.schemaKey).toBe("custom_objects.band_submission");
    expect(inbox.records[0]?.displayName).toBe("The River Band");

    const updated = await updateBookingFields("band_submission", "rec_1", { status: "Booked" }, deps);
    expect(updated).toEqual({ ok: true });

    const put = calls.find((call) => call.method === "PUT");
    expect(put).toBeTruthy();
    expect(put?.headers.get("Authorization")).toBe("Bearer pit_test");
    expect(put?.headers.get("Version")).toBe("2021-07-28");
    expect(JSON.stringify(inbox)).not.toContain("pit_test");
  });

  it("posts a search through the client helper", async () => {
    const fetchImpl: typeof fetch = async (_input, init) => {
      expect(init?.method).toBe("POST");
      return jsonResponse({ records: [] });
    };
    const payload = await searchRecords(
      "custom_objects.band_submission",
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
    await updateRecord("custom_objects.band_submission", "rec_9", { booking_status: "Held" }, configuredDeps(fetchImpl));
  });
});
