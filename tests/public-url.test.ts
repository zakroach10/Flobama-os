import { describe, expect, it } from "vitest";
import { buildPublicSurfaceUrls, joinPublicUrl, normalizeOrigin, PRODUCTION_SITE_URL } from "@/lib/public/urls";

describe("public site URLs", () => {
  it("normalizes trailing slashes and missing protocols", () => {
    expect(normalizeOrigin("https://flobama-os.vercel.app/")).toBe("https://flobama-os.vercel.app");
    expect(normalizeOrigin("flobama-os.vercel.app")).toBe("https://flobama-os.vercel.app");
    expect(normalizeOrigin("http://localhost:43123/")).toBe("http://localhost:43123");
  });

  it("builds embed, overlay, and API URLs from the public origin", () => {
    const surfaces = buildPublicSurfaceUrls("https://flobama-os.vercel.app/");
    expect(surfaces.origin).toBe(PRODUCTION_SITE_URL);
    expect(surfaces.embed).toBe("https://flobama-os.vercel.app/embed/events");
    expect(surfaces.embedScript).toBe("https://flobama-os.vercel.app/embed/events.js");
    expect(surfaces.overlay).toBe("https://flobama-os.vercel.app/overlay");
    expect(surfaces.eventsApi).toBe("https://flobama-os.vercel.app/api/public/v1/events");
    expect(surfaces.verticalDisplay).toBe("https://flobama-os.vercel.app/display/vertical");
    expect(surfaces.verticalApi).toBe("https://flobama-os.vercel.app/api/public/v1/screens/vertical");
    expect(surfaces.weekApi).toBe("https://flobama-os.vercel.app/api/public/v1/screens/week");
    expect(surfaces.weekFlyer).toBe("https://flobama-os.vercel.app/print/week");
    expect(surfaces.weekSocial).toBe("https://flobama-os.vercel.app/print/week/social");
    expect(surfaces.embedSnippet).toContain('src="https://flobama-os.vercel.app/embed/events"');
    expect(surfaces.embedSnippet).toContain("https://flobama-os.vercel.app/embed/events.js");
    expect(joinPublicUrl("https://flobama-os.vercel.app/", "overlay")).toBe(
      "https://flobama-os.vercel.app/overlay",
    );
  });
});
