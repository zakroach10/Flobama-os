import { describe, expect, it } from "vitest";
import {
  bandPacketFileName,
  bandPacketPath,
  bandPacketTitle,
  filterRecordsForPacket,
  formatPacketMonthLabel,
  isValidPacketMonth,
  listPacketMonths,
  parseBandPacketSelection,
  recordMonthKey,
} from "@/lib/booking/packet";
import type { BookingRecord } from "@/lib/ghl/objects";

function record(partial: Partial<BookingRecord> & { id: string }): BookingRecord {
  return {
    schemaKey: "custom_objects.band_inquiries",
    displayName: partial.id,
    contactName: null,
    email: null,
    phone: null,
    contactId: null,
    contactLinkStatus: "none",
    contactLinkMessage: null,
    requestedDates: null,
    compensation: null,
    status: null,
    notes: null,
    updatedAt: null,
    createdAt: null,
    properties: {},
    statusOptions: [],
    statusFieldKey: null,
    notesFieldKey: null,
    inquiry: null,
    ...partial,
  };
}

describe("band packet selection", () => {
  it("parses all, month, and selected scopes", () => {
    expect(parseBandPacketSelection({ scope: "all" })).toEqual({ scope: "all" });
    expect(parseBandPacketSelection({ scope: "month", month: "2026-03" })).toEqual({
      scope: "month",
      month: "2026-03",
    });
    expect(parseBandPacketSelection({ ids: "a,b,a" })).toEqual({ scope: "selected", ids: ["a", "b"] });
  });

  it("rejects invalid month and empty selection", () => {
    expect(parseBandPacketSelection({ scope: "month", month: "2026-13" })).toEqual({
      error: "Choose a valid month (YYYY-MM).",
    });
    expect(parseBandPacketSelection({ scope: "selected", ids: "" })).toEqual({
      error: "Select at least one submission.",
    });
  });

  it("validates month keys", () => {
    expect(isValidPacketMonth("2026-10")).toBe(true);
    expect(isValidPacketMonth("2026-00")).toBe(false);
  });
});

describe("band packet filtering", () => {
  const records = [
    record({ id: "a", createdAt: "2026-03-05T12:00:00.000Z", updatedAt: "2026-03-06T12:00:00.000Z" }),
    record({ id: "b", createdAt: "2026-02-01T12:00:00.000Z", updatedAt: "2026-02-02T12:00:00.000Z" }),
    record({ id: "c", createdAt: null, updatedAt: "2026-03-20T12:00:00.000Z" }),
  ];

  it("reads month from createdAt then updatedAt", () => {
    expect(recordMonthKey(records[0]!)).toBe("2026-03");
    expect(recordMonthKey(records[2]!)).toBe("2026-03");
  });

  it("lists months newest first", () => {
    expect(listPacketMonths(records)).toEqual(["2026-03", "2026-02"]);
  });

  it("filters by month and selected ids in request order", () => {
    expect(filterRecordsForPacket(records, { scope: "month", month: "2026-03" }).map((item) => item.id)).toEqual([
      "c",
      "a",
    ]);
    expect(filterRecordsForPacket(records, { scope: "selected", ids: ["b", "missing", "a"] }).map((item) => item.id)).toEqual([
      "b",
      "a",
    ]);
    expect(filterRecordsForPacket(records, { scope: "all" })).toHaveLength(3);
  });

  it("builds path, title, and filename", () => {
    expect(bandPacketPath({ scope: "month", month: "2026-03" })).toContain("scope=month");
    expect(bandPacketPath({ scope: "month", month: "2026-03" }, { print: true })).toContain("print=1");
    expect(formatPacketMonthLabel("2026-03")).toBe("March 2026");
    expect(bandPacketTitle({ scope: "month", month: "2026-03" }, 2)).toContain("March 2026");
    expect(bandPacketFileName({ scope: "all" }, 4)).toMatch(/^flobama-band-packet-all-4-/);
  });
});
