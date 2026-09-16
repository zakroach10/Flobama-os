import { describe, expect, it } from "vitest";
import {
  diffNewBandSubmissionIds,
  extractBandWebhookPayload,
  isMondayInVenueTz,
  mergeSeenIds,
  venueLocalDateKey,
} from "@/lib/notifications/jobs";

describe("notification job helpers", () => {
  it("diffs and merges seen band submission ids", () => {
    expect(diffNewBandSubmissionIds(["a", "b", "c"], ["a"])).toEqual(["b", "c"]);
    expect(mergeSeenIds(["old"], ["b", "a"], 10)).toEqual(["b", "a", "old"]);
    expect(mergeSeenIds(["1", "2", "3"], ["4"], 3)).toEqual(["4", "1", "2"]);
  });

  it("detects Monday in America/Chicago", () => {
    // Monday 2026-09-14 15:00 UTC = 10:00 CDT Monday
    expect(isMondayInVenueTz(new Date("2026-09-14T15:00:00.000Z"))).toBe(true);
    // Sunday
    expect(isMondayInVenueTz(new Date("2026-09-13T15:00:00.000Z"))).toBe(false);
    expect(venueLocalDateKey(new Date("2026-09-14T15:00:00.000Z"))).toBe("2026-09-14");
  });

  it("extracts band id/name from common webhook shapes", () => {
    expect(
      extractBandWebhookPayload({
        id: "rec_1",
        name: "The River Band",
      }),
    ).toEqual({ id: "rec_1", name: "The River Band" });

    expect(
      extractBandWebhookPayload({
        data: { recordId: "rec_2", artist_band_name: "Coastline" },
      }),
    ).toEqual({ id: "rec_2", name: "Coastline" });
  });
});
