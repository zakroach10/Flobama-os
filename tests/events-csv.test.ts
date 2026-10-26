import { describe, expect, it } from "vitest";
import { EVENTS_CSV_SAMPLE, parseEventCsv, parseEventCsvTime } from "@/lib/events/csv";

describe("events CSV parser", () => {
  it("reads 24-hour times without shifting morning hours to PM", () => {
    expect(parseEventCsvTime("09:00")).toBe("09:00");
    expect(parseEventCsvTime("18:30")).toBe("18:30");
    expect(parseEventCsvTime("6:30 PM")).toBe("18:30");
    expect(parseEventCsvTime("10:00:00 AM")).toBe("10:00");
  });

  it("parses the sample spreadsheet", () => {
    const result = parseEventCsv(EVENTS_CSV_SAMPLE, "America/Chicago");
    expect(result.errors).toEqual([]);
    expect(result.events).toHaveLength(3);
    expect(result.events[0]).toMatchObject({
      title: "Friday Live Music",
      eventType: "live_music",
      startDate: "2026-11-07",
      startTime: "18:30",
      endDate: "2026-11-07",
      endTime: "22:00",
      status: "draft",
      visibility: "public",
      featured: false,
      isTicketed: false,
      coverLabel: "$5",
      artistNames: ["The Swampers"],
    });
    expect(result.events[1]?.eventType).toBe("karaoke");
    expect(result.events[1]?.endDate).toBe("2026-11-09");
    expect(result.events[2]).toMatchObject({
      featured: true,
      isTicketed: true,
      ticketUrl: "https://example.com/tickets",
      artistNames: ["Band One", "Band Two"],
    });
  });

  it("defaults missing end times and status", () => {
    const csv = `title,start_date,start_time,artists
Dinner Set,11/7/26,18:30,Rewind
Late Night,2026-11-07,22:00,
`;
    const result = parseEventCsv(csv, "America/Chicago");
    expect(result.errors).toEqual([]);
    expect(result.events[0]).toMatchObject({
      endDate: "2026-11-07",
      endTime: "21:30",
      status: "draft",
      eventType: "live_music",
      artistNames: ["Rewind"],
    });
    expect(result.events[1]).toMatchObject({
      endDate: "2026-11-08",
      endTime: "01:00",
    });
  });

  it("reports invalid rows without importing them", () => {
    const csv = `title,start_date,start_time,end_date,end_time
Good Show,2026-11-07,18:30,2026-11-07,22:00
,2026-11-08,19:00,2026-11-08,22:00
Bad End,2026-11-09,20:00,2026-11-09,19:00
`;
    const result = parseEventCsv(csv, "America/Chicago");
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.title).toBe("Good Show");
    expect(result.errors.some((error) => /title is required/i.test(error))).toBe(true);
    expect(result.errors.some((error) => /end must be after start/i.test(error))).toBe(true);
  });
});
