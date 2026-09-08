import { describe, expect, it } from "vitest";
import {
  countLocalInterpretations,
  eventOverlapsVenueDay,
  parseVenueLocalDateTime,
  toVenueDateInput,
  toVenueTimeInput,
  venueDayBounds,
} from "@/lib/timezone";

const ZONE = "America/Chicago";

describe("venue local parsing", () => {
  it("converts a normal Chicago evening to UTC", () => {
    const result = parseVenueLocalDateTime("2026-01-15", "20:00", ZONE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.iso).toBe("2026-01-16T02:00:00.000Z");
    }
  });

  it("rejects the spring-forward gap", () => {
    const result = parseVenueLocalDateTime("2026-03-08", "02:30", ZONE);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_local");
  });

  it("detects the fall-back overlap as ambiguous", () => {
    expect(countLocalInterpretations("2025-11-02", "01:30", ZONE)).toBeGreaterThan(1);
    const result = parseVenueLocalDateTime("2025-11-02", "01:30", ZONE);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("ambiguous_local");
  });

  it("round-trips an overnight event across midnight", () => {
    const start = parseVenueLocalDateTime("2026-06-12", "21:00", ZONE);
    const end = parseVenueLocalDateTime("2026-06-13", "01:30", ZONE);
    expect(start.ok && end.ok).toBe(true);
    if (start.ok && end.ok) {
      expect(end.dateTime.toMillis()).toBeGreaterThan(start.dateTime.toMillis());
      expect(toVenueDateInput(end.iso, ZONE)).toBe("2026-06-13");
      expect(toVenueTimeInput(end.iso, ZONE)).toBe("01:30");
    }
  });
});

describe("dashboard today overlap", () => {
  it("includes a show that started the previous evening", () => {
    const instant = new Date("2026-06-13T10:00:00.000Z");
    const starts = "2026-06-13T02:00:00.000Z";
    const ends = "2026-06-13T06:30:00.000Z";
    expect(eventOverlapsVenueDay(starts, ends, instant, ZONE)).toBe(true);
  });

  it("excludes a show that ended before the venue-local day", () => {
    const instant = new Date("2026-06-13T10:00:00.000Z");
    const starts = "2026-06-12T01:00:00.000Z";
    const ends = "2026-06-12T04:00:00.000Z";
    expect(eventOverlapsVenueDay(starts, ends, instant, ZONE)).toBe(false);
  });

  it("does not hardcode a calendar date for day bounds", () => {
    const first = venueDayBounds(new Date("2026-01-01T06:00:00.000Z"), ZONE);
    const second = venueDayBounds(new Date("2026-07-04T06:00:00.000Z"), ZONE);
    expect(first.start.toISODate()).not.toBe(second.start.toISODate());
  });
});
