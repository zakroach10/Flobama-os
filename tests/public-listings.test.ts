import { describe, expect, it } from "vitest";
import {
  assertNoInternalFields,
  isPubliclyListable,
  parseLimit,
  parsePublicRange,
  toPublicEventJson,
  type StaffEventForPublic,
} from "@/lib/public/listings";

function fixture(overrides: Partial<StaffEventForPublic> = {}): StaffEventForPublic {
  return {
    id: "11111111-1111-4111-8111-111111111112",
    title: "KGB Band",
    event_type: "live_music",
    starts_at: "2026-09-08T00:00:00.000Z",
    ends_at: "2026-09-08T03:00:00.000Z",
    location_label: "Main room",
    featured: true,
    is_ticketed: false,
    ticket_url: null,
    cover_label: "$0.00",
    status: "published",
    visibility: "public",
    archived_at: null,
    internal_notes: "Do not print this",
    created_by: "ea401b6e-06b7-4ce1-b75a-2fae6f9bfac5",
    artists: ["KGB Band"],
    ...overrides,
  };
}

describe("public listings filter", () => {
  it("keeps only published public unarchived events", () => {
    expect(isPubliclyListable(fixture())).toBe(true);
    expect(isPubliclyListable(fixture({ status: "draft" }))).toBe(false);
    expect(isPubliclyListable(fixture({ visibility: "private" }))).toBe(false);
    expect(isPubliclyListable(fixture({ archived_at: "2026-09-01T00:00:00.000Z" }))).toBe(false);
    expect(isPubliclyListable(fixture({ status: "cancelled" }))).toBe(false);
  });

  it("never serializes notes or staff fields", () => {
    const json = toPublicEventJson(fixture());
    expect(json).not.toBeNull();
    expect(assertNoInternalFields(json!)).toBe(true);
    expect(JSON.stringify(json)).not.toMatch(/Do not print this/);
    expect(JSON.stringify(json)).not.toMatch(/internal/i);
    expect(json?.name).toBe("KGB Band");
    expect(json?.coverCharge).toBe("$0.00");
    expect(toPublicEventJson(fixture({ status: "draft" }))).toBeNull();
  });

  it("defaults upcoming from now and caps limit", () => {
    const range = parsePublicRange(null, null, true, new Date("2026-09-08T17:00:00.000Z"));
    expect(range.fromIso).toBe("2026-09-08T17:00:00.000Z");
    expect(parseLimit("12")).toBe(12);
    expect(parseLimit("9999")).toBe(200);
  });
});
