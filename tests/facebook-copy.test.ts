import { describe, expect, it } from "vitest";
import { buildFacebookCopy, resolveFacebookTimeZone } from "@/lib/events/facebook-copy";
import { applyEventSaveIntent, eventSaveMessage } from "@/lib/events/submit";

const SECRET = "door code 8841 — staff only";

describe("facebook copy", () => {
  it("builds a Facebook post and event setup from public fields in America/Chicago", () => {
    const pack = buildFacebookCopy({
      title: "River Night",
      publicDescription: "A downtown show.\nDetails at https://flobamadowntown.com/shows.",
      startsAt: "2026-01-16T02:00:00.000Z",
      endsAt: "2026-01-16T05:00:00.000Z",
      timeZone: null,
      locationLabel: "Main room",
      venueName: "FloBama",
      hosts: ["The Blue Notes", " the blue notes ", "Ada", ""],
      ticketUrl: "https://tickets.example.com/river",
      coverLabel: "$10",
      isTicketed: true,
      eventType: "live_music",
      internalNotes: SECRET,
      internal_notes: SECRET,
    } as Parameters<typeof buildFacebookCopy>[0] & { internalNotes: string; internal_notes: string });

    expect(pack.timeZone).toBe("America/Chicago");
    expect(pack.post).toBe(
      [
        "River Night",
        "",
        "A downtown show.",
        "Details at https://flobamadowntown.com/shows.",
        "",
        "When: Thursday, January 15, 2026, 8:00 PM – 11:00 PM CST",
        "Where: FloBama · Main room",
        "Hosts: The Blue Notes, Ada",
        "Price: $10",
        "Tickets: https://tickets.example.com/river",
        "Links:",
        "https://flobamadowntown.com/shows",
      ].join("\n"),
    );
    expect(pack.eventSetup).toBe(
      [
        "Event name: River Night",
        "Start date: Thursday, January 15, 2026",
        "Start time: 8:00 PM",
        "End date: Thursday, January 15, 2026",
        "End time: 11:00 PM",
        "Timezone: America/Chicago (CST)",
        "Location: FloBama · Main room",
        "Description:",
        "A downtown show.",
        "Details at https://flobamadowntown.com/shows.",
        "Hosts: The Blue Notes, Ada",
        "Category: Live music",
        "Price: $10",
        "Tickets: https://tickets.example.com/river",
        "Links:",
        "https://flobamadowntown.com/shows",
      ].join("\n"),
    );
    expect(pack.post).not.toContain("Live music");
    expect(pack.post).not.toContain("Event name");
    expect(JSON.stringify(pack)).not.toContain(SECRET);
    expect(JSON.stringify(pack).toLowerCase()).not.toContain("internal");

    for (const item of pack.postFields) {
      expect(pack.post).toContain(item.value);
    }
    for (const item of pack.eventFields) {
      expect(pack.eventSetup).toContain(item.value);
    }
  });

  it("formats an overnight show on both dates and prefers the event timezone", () => {
    const pack = buildFacebookCopy({
      title: "Late Set",
      startsAt: "2026-06-13T02:00:00.000Z",
      endsAt: "2026-06-13T06:30:00.000Z",
      startDate: "2026-01-01",
      startTime: "00:00",
      endDate: "2026-01-01",
      endTime: "01:00",
      timeZone: "America/Chicago",
      venueName: "FloBama",
      locationLabel: "FloBama",
    });

    expect(pack.post).toContain("Friday, June 12, 2026, 9:00 PM – Saturday, June 13, 2026, 1:30 AM CDT");
    expect(pack.post).not.toContain("January");
    expect(pack.eventFields.find((field) => field.key === "location")?.value).toBe("FloBama");
    expect(pack.eventFields.find((field) => field.key === "timezone")?.value).toBe("America/Chicago (CDT)");
  });

  it("uses venue-local form times and defaults an unknown zone to America/Chicago", () => {
    expect(resolveFacebookTimeZone(" ")).toBe("America/Chicago");
    expect(resolveFacebookTimeZone("Not/AZone")).toBe("America/Chicago");

    const pack = buildFacebookCopy({
      title: "Local Draft",
      startDate: "2026-01-15",
      startTime: "20:00",
      endDate: "2026-01-15",
      endTime: "23:00",
      timeZone: "Not/AZone",
      locationLabel: "Patio",
      isTicketed: true,
    });

    expect(pack.timeZone).toBe("America/Chicago");
    expect(pack.post).toContain("When: Thursday, January 15, 2026, 8:00 PM – 11:00 PM CST");
    expect(pack.post).toContain("Where: Patio");
    expect(pack.post).toContain("Tickets: Ticketed");
    expect(pack.postFields.some((field) => field.key === "price")).toBe(false);
    expect(pack.postFields.some((field) => field.key === "hosts")).toBe(false);
    expect(pack.postFields.some((field) => field.key === "description")).toBe(false);
    expect(pack.eventFields.some((field) => field.key === "category")).toBe(false);
  });

  it("keeps the ticket link out of the extra links list and drops blank public fields", () => {
    const pack = buildFacebookCopy({
      title: "Link Night",
      publicDescription: "Tickets at https://tickets.example.com/river. Also see https://example.com/info.",
      startsAt: "2026-01-16T02:00:00.000Z",
      endsAt: "2026-01-16T05:00:00.000Z",
      ticketUrl: "https://tickets.example.com/river/",
    });

    expect(pack.postFields.find((field) => field.key === "links")?.value).toBe("https://example.com/info");
    expect(pack.postFields.find((field) => field.key === "tickets")?.value).toBe("https://tickets.example.com/river/");
    expect(pack.post).toContain("https://tickets.example.com/river");
  });
});

describe("event save intent", () => {
  it("publishes without changing a normal save", () => {
    const draft = { title: "River Night", status: "draft" as const, internalNotes: SECRET };
    expect(applyEventSaveIntent(draft, "save")).toEqual(draft);
    expect(draft.status).toBe("draft");

    const published = applyEventSaveIntent(draft, "publish");
    expect(published.status).toBe("published");
    expect(published.internalNotes).toBe(SECRET);
    expect(published.title).toBe("River Night");
    expect(draft.status).toBe("draft");

    expect(eventSaveMessage(false, "save")).toBe("Event created.");
    expect(eventSaveMessage(true, "save")).toBe("Event saved.");
    expect(eventSaveMessage(false, "publish")).toBe(
      "Published. Public listings, embed, and API include this event when visibility is public.",
    );
    expect(eventSaveMessage(true, "publish")).toBe(eventSaveMessage(false, "publish"));
  });
});
