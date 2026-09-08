import { describe, expect, it } from "vitest";
import { authorizeProgramming, authorizeVenueSettings, canManageProgramming } from "@/lib/auth/permissions";
import { safeInternalPath } from "@/lib/auth/redirects";
import { eventFormSchema } from "@/lib/validation/schemas";
import { missingPublicEnvNames } from "@/lib/env";

describe("permissions", () => {
  it("lets managers edit programming but not venue settings", () => {
    expect(canManageProgramming("manager")).toBe(true);
    expect(authorizeProgramming("manager").allowed).toBe(true);
    expect(authorizeVenueSettings("manager").allowed).toBe(false);
  });

  it("blocks viewers from mutations", () => {
    expect(authorizeProgramming("viewer").allowed).toBe(false);
    expect(authorizeVenueSettings("viewer").allowed).toBe(false);
  });

  it("does not treat a missing role as staff", () => {
    expect(authorizeProgramming(null).allowed).toBe(false);
  });
});

describe("auth redirects", () => {
  it("rejects open redirects", () => {
    expect(safeInternalPath("https://evil.example", "/dashboard")).toBe("/dashboard");
    expect(safeInternalPath("//evil.example", "/dashboard")).toBe("/dashboard");
    expect(safeInternalPath("/events/new", "/dashboard")).toBe("/events/new");
  });
});

describe("event validation", () => {
  it("requires end after start", () => {
    const result = eventFormSchema.safeParse({
      title: "Late set",
      eventType: "live_music",
      startDate: "2026-06-12",
      startTime: "22:00",
      endDate: "2026-06-12",
      endTime: "21:00",
      status: "draft",
      visibility: "public",
      featured: false,
      artistIds: [],
      timeZone: "America/Chicago",
    });
    expect(result.success).toBe(false);
  });

  it("accepts an overnight live show", () => {
    const result = eventFormSchema.safeParse({
      title: "Late set",
      eventType: "live_music",
      startDate: "2026-06-12",
      startTime: "21:00",
      endDate: "2026-06-13",
      endTime: "01:00",
      status: "draft",
      visibility: "public",
      featured: false,
      artistIds: [],
      timeZone: "America/Chicago",
    });
    expect(result.success).toBe(true);
  });

  it("requires date review when duplicating", () => {
    const result = eventFormSchema.safeParse({
      title: "Copy",
      eventType: "dj",
      startDate: "2026-06-12",
      startTime: "21:00",
      endDate: "2026-06-12",
      endTime: "23:00",
      status: "draft",
      visibility: "public",
      featured: false,
      artistIds: [],
      timeZone: "America/Chicago",
      isDuplicateDraft: true,
      datesReviewed: false,
    });
    expect(result.success).toBe(false);
  });
});

describe("missing configuration", () => {
  it("lists required public env names without throwing", () => {
    const missing = missingPublicEnvNames();
    expect(Array.isArray(missing)).toBe(true);
    expect(missing.includes("NEXT_PUBLIC_SUPABASE_URL") || missing.length === 0).toBe(true);
  });
});
