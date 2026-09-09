import { describe, expect, it } from "vitest";
import { FLOBAMA_LOGO_ALT, FLOBAMA_LOGO_SRC } from "@/lib/brand";
import { fillVenueWeekDays } from "@/lib/screens/week";
import { DEMO_WEEK_SLIDE } from "@/lib/screens/demo";

describe("FloBama wordmark", () => {
  it("serves the transparent sticker logo from public/", () => {
    expect(FLOBAMA_LOGO_SRC).toBe("/flobama-logo.png");
    expect(FLOBAMA_LOGO_ALT).toBe("FloBama");
  });

  it("fills every venue day so kiosk and flyer share the same lineup", () => {
    const days = fillVenueWeekDays(DEMO_WEEK_SLIDE.days, new Date("2026-09-08T22:00:00.000Z"));
    expect(days).toHaveLength(7);
    expect(days.map((day) => day.weekday)).toEqual([
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ]);
    expect(days[2]?.events[0]?.name).toBe("Slaw Dogs");
    expect(days[5]?.events.map((event) => event.name)).toEqual(["Karaoke", "Late set"]);
  });
});
