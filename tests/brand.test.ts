import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FLOBAMA_LOGO_ALT, FLOBAMA_LOGO_SRC, flobamaLogoHeight } from "@/lib/brand";
import { SOCIAL_POSTER_ASSETS } from "@/lib/screens/social-poster";
import { liveWeekDays } from "@/lib/screens/week";
import { DEMO_WEEK_SLIDE } from "@/lib/screens/demo";

describe("FloBama wordmark", () => {
  it("serves the transparent wordmark from public/", () => {
    expect(FLOBAMA_LOGO_SRC).toBe("/flobama-logo.png?v=3");
    expect(FLOBAMA_LOGO_ALT).toBe("FloBama");
    expect(SOCIAL_POSTER_ASSETS.sticker).toBe(FLOBAMA_LOGO_SRC);
    expect(flobamaLogoHeight(1500)).toBe(495);
    expect(existsSync(join(process.cwd(), "public/flobama-logo.png"))).toBe(true);
  });
});

describe("weekly lineup days", () => {
  it("drops nights with no shows from flyers and kiosk slides", () => {
    const days = liveWeekDays(DEMO_WEEK_SLIDE.days);
    expect(days.map((day) => day.weekday)).toEqual(["Tuesday", "Friday"]);
    expect(days[0]?.events[0]?.name).toBe("Slaw Dogs");
    expect(days[1]?.events.map((event) => event.name)).toEqual(["Karaoke", "Late set"]);
  });
});
