import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  artistNameFromTitle,
  defaultEndClock,
  inferEventType,
  parseLegacySheet,
  parseSheetDate,
  parseSheetTime,
} from "@/lib/legacy/parser";
import { FLO_BAMA_MASTER_SHEET_CSV_URL, looksLikeMasterSheetCsv } from "@/lib/legacy/sheet";

describe("legacy sheet parser", () => {
  it("reads Excel serial times as time-of-day only", () => {
    expect(parseSheetTime("1899-12-30 18:30:00")).toBe("18:30");
    expect(parseSheetTime("1899-12-30 22:00:00")).toBe("22:00");
    expect(parseSheetTime("6:30:00 PM")).toBe("18:30");
    expect(parseSheetTime("10:00:00 PM")).toBe("22:00");
    expect(parseSheetTime("6:30")).toBe("18:30");
  });

  it("parses US and ISO dates without using the Excel epoch", () => {
    expect(parseSheetDate("7/25/26")).toBe("2026-07-25");
    expect(parseSheetDate("08/15/26")).toBe("2026-08-15");
    expect(parseSheetDate("2026-10-31")).toBe("2026-10-31");
  });

  it("defaults end time to +3 hours, or 1:00 AM next day after 9:00 PM", () => {
    expect(defaultEndClock("2026-09-08", "19:00")).toEqual({ endDate: "2026-09-08", endTime: "22:00" });
    expect(defaultEndClock("2026-09-08", "21:00")).toEqual({ endDate: "2026-09-09", endTime: "01:00" });
    expect(defaultEndClock("2026-09-08", "22:00")).toEqual({ endDate: "2026-09-09", endTime: "01:00" });
  });

  it("skips archived, unpublished, and the test event", () => {
    const csv = `Name,Day,Date,Time,Ticketed,Ticket Link,Cover Charge,Event ID,Published,Archived,Internal Notes
Karaoke,Wednesday,8/19/26,1899-12-30 18:00:00,No,N/a,$0.00,evt_keep_me,Yes,No,
Archived Band,Friday,8/21/26,6:30:00 PM,No,N/a,$0.00,evt_archived,Yes,Yes,
Draft Band,Friday,8/21/26,6:30:00 PM,No,N/a,$0.00,evt_draft,No,No,
Test Event,Monday,2026-08-03,8:00 PM,Yes,zakary.info,Free,evt_test,No,Yes,secret
`;
    const result = parseLegacySheet(csv);
    expect(result.importable).toHaveLength(1);
    expect(result.importable[0]?.legacySourceId).toBe("evt_keep_me");
    expect(result.skipped.map((row) => row.reason).sort()).toEqual(["archived", "test_event", "unpublished"]);
    expect(result.withdrawn.map((row) => row.legacySourceId).sort()).toEqual(["evt_archived", "evt_draft"]);
  });

  it("classifies karaoke, DJ, and sports titles and never names an artist Karaoke", () => {
    expect(inferEventType("Karaoke")).toBe("karaoke");
    expect(inferEventType("Karaoke/ DJ")).toBe("dj");
    expect(inferEventType("Austin Bohannon & Hunter (LSU vs Tennessee Game)")).toBe("sports");
    expect(inferEventType("KGB Band")).toBe("live_music");
    expect(artistNameFromTitle("Karaoke")).toBeNull();
    expect(artistNameFromTitle("Karaoke Late Night")).toBeNull();
    expect(artistNameFromTitle("Misfits for Dinner")).toBe("Misfits");
    expect(artistNameFromTitle("Kirbi Music and Friends (Ticketed Show)")).toBe("Kirbi Music and Friends");
  });

  it("updates 43 published unarchived rows from the master sheet snapshot", () => {
    const csv = readFileSync(path.join(process.cwd(), "data/legacy-events.csv"), "utf8");
    const result = parseLegacySheet(csv);
    expect(result.importable).toHaveLength(43);
    expect(result.importable.every((row) => row.legacySourceId.startsWith("evt_"))).toBe(true);
    expect(result.importable.some((row) => row.title === "Test Event")).toBe(false);
    expect(result.importable.some((row) => row.artistName === "Karaoke")).toBe(false);
    const kirbi = result.importable.find((row) => row.legacySourceId === "evt_0fa19689b0a7");
    expect(kirbi?.isTicketed).toBe(true);
    expect(kirbi?.ticketUrl).toBe("https://mk360.me/flobama-kirbi");
    expect(kirbi?.coverLabel).toBe("$10.00");
    const late = result.importable.find((row) => row.legacySourceId === "evt_8d16679dbfac");
    expect(late?.eventType).toBe("dj");
    expect(late?.endsAtIso).toContain("2026-08-22");
    const misfits = result.importable.find((row) => row.legacySourceId === "evt_271cd003253e");
    expect(misfits?.title).toBe("The Misfits");
    expect(misfits?.startsAtIso).toContain("2026-09-11");
    const dejaVu = result.importable.find((row) => row.legacySourceId === "evt_6c8372ef877b");
    expect(dejaVu?.title).toBe("Deja Vu");
    expect(dejaVu?.startsAtIso).toContain("2026-09-12");
  });

  it("recognizes the published master sheet CSV", () => {
    const csv = readFileSync(path.join(process.cwd(), "data/legacy-events.csv"), "utf8");
    expect(looksLikeMasterSheetCsv(csv)).toBe(true);
    expect(looksLikeMasterSheetCsv("<html>nope</html>")).toBe(false);
    expect(FLO_BAMA_MASTER_SHEET_CSV_URL).toContain("output=csv");
  });
});

