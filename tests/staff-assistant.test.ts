import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined }),
}));
import { StaffAssistant } from "@/components/assistant/staff-assistant";
import { speechTranscript } from "@/lib/assistant/speech";
import { showStaffAssistant } from "@/lib/assistant/access";
import { completeAssistantPlan } from "@/lib/assistant/openai";
import {
  assistantContextPayload,
  eventRecordToFormInput,
  fillEventWindow,
  matchAssistantEvent,
  matchCatalogItem,
  prepareAssistantPlan,
  sanitizeConversation,
  type AssistantCatalog,
  type AssistantPlan,
} from "@/lib/assistant/plan";

const catalogArtists = [
  { id: "a1", name: "The Steel Woods" },
  { id: "a2", name: "Karaoke" },
];

function plan(overrides: Partial<AssistantPlan> = {}): AssistantPlan {
  return {
    reply: "Working on it.",
    action: "none",
    artist: null,
    event: null,
    listing: null,
    wallName: null,
    youtubeUrl: null,
    ...overrides,
  };
}

describe("staff assistant panel", () => {
  it("renders the Ask button for a manager", () => {
    const html = renderToStaticMarkup(
      createElement(StaffAssistant, { canProgram: true, canChangeWall: true, configured: true }),
    );
    expect(html).toContain("Ask");
    expect(html).toContain("aria-expanded=\"false\"");
  });

  it("offers a microphone in the open assistant", () => {
    const html = renderToStaticMarkup(
      createElement(StaffAssistant, {
        canProgram: true,
        canChangeWall: true,
        configured: true,
        placement: "dock",
        initialOpen: true,
      }),
    );
    expect(html).toContain("Speak to the assistant");
    expect(html).toContain("Speak or type");
  });
});

describe("speech transcript", () => {
  it("joins final and interim words into one request", () => {
    expect(
      speechTranscript([
        { transcript: " put house ads ", isFinal: true },
        { transcript: " on the wall", isFinal: false },
      ]),
    ).toBe("put house ads on the wall");
  });
});

describe("staff assistant access", () => {
  it("shows the chat for managers and viewers, and hides audience and server consoles", () => {
    expect(showStaffAssistant(["dashboard", "programming"], "manager")).toBe(true);
    expect(showStaffAssistant(["dashboard", "screens"], "viewer")).toBe(true);
    expect(showStaffAssistant(["audience"], "interactor")).toBe(false);
    expect(showStaffAssistant(["server"], "server")).toBe(false);
    expect(showStaffAssistant(["screens"], "viewer")).toBe(true);
  });
});

describe("staff assistant catalog matching", () => {
  it("matches band names with or without The", () => {
    const hit = matchCatalogItem(catalogArtists, "Steel Woods", "artist");
    expect(hit.ok && hit.item.id).toBe("a1");
  });

  it("asks which event when titles collide", () => {
    const events = [
      {
        id: "e1",
        name: "Karaoke",
        title: "Karaoke",
        when: "Fri, Nov 6, 8:00 PM",
        status: "draft",
        visibility: "public",
        artists: [],
      },
      {
        id: "e2",
        name: "Karaoke",
        title: "Karaoke",
        when: "Sat, Nov 7, 8:00 PM",
        status: "published",
        visibility: "public",
        artists: [],
      },
    ];
    const ambiguous = matchAssistantEvent(events, "Karaoke", null);
    expect(ambiguous.ok).toBe(false);
    if (!ambiguous.ok) expect(ambiguous.message).toContain("Nov 6");
    const picked = matchAssistantEvent(events, "Karaoke", "Sat, Nov 7, 8:00 PM");
    expect(picked.ok && picked.event.id).toBe("e2");
  });
});

describe("staff assistant safety", () => {
  it("keeps a new show as a draft until staff ask to publish", () => {
    const next = prepareAssistantPlan(
      plan({
        action: "create_event",
        reply: "Publishing Friday.",
        event: {
          title: "Friday Night",
          eventType: "live_music",
          startDate: "2026-11-06",
          startTime: "20:00",
          endDate: null,
          endTime: null,
          status: "published",
          visibility: "public",
          artistNames: ["Steel Woods"],
          createMissingArtists: true,
          publicDescription: null,
          locationLabel: null,
          coverLabel: null,
          ticketUrl: null,
          featured: true,
        },
      }),
      "Add a Friday show for Steel Woods at 8",
    );
    expect(next.action).toBe("create_event");
    expect(next.event?.status).toBe("draft");
    expect(next.event?.featured).toBe(false);
  });

  it("allows publish when the message asks for the website", () => {
    const next = prepareAssistantPlan(
      plan({
        action: "update_listing",
        listing: { title: "Friday Night", when: null, status: "published", visibility: "public" },
      }),
      "Publish Friday Night on the website",
    );
    expect(next.action).toBe("update_listing");
    expect(next.listing?.status).toBe("published");
  });

  it("does not change the wall when the message is only a question", () => {
    const next = prepareAssistantPlan(
      plan({ action: "resume_house_ads", reply: "House ads are the current scene." }),
      "What's on the wall?",
    );
    expect(next.action).toBe("none");
    expect(next.reply).toContain("House ads");
  });

  it("refuses a cancel the staff member did not ask for", () => {
    const next = prepareAssistantPlan(
      plan({
        action: "update_listing",
        listing: { title: "Friday Night", when: null, status: "cancelled", visibility: null },
      }),
      "What is on the wall?",
    );
    expect(next.action).toBe("none");
  });

  it("rolls a late start into the next morning", () => {
    const window = fillEventWindow("2026-11-06", "22:00", null, null, "America/Chicago");
    expect(window).toEqual({
      startDate: "2026-11-06",
      startTime: "22:00",
      endDate: "2026-11-07",
      endTime: "01:00",
    });
  });
});

describe("staff assistant context", () => {
  it("sends names to the model and keeps record ids local", () => {
    const catalog: AssistantCatalog = {
      timeZone: "America/Chicago",
      nowLabel: "Saturday, Oct 31, 2026 • 1:48 PM",
      canProgram: true,
      canChangeWall: true,
      canPlayYoutube: true,
      wall: { scene: "House ads", playlist: null },
      scenes: [{ id: "scene-secret", name: "House ads" }],
      playlists: [],
      artists: [{ id: "artist-secret", name: "The Steel Woods" }],
      events: [
        {
          id: "event-secret",
          name: "Friday Night",
          title: "Friday Night",
          when: "Fri, Nov 6, 8:00 PM",
          status: "draft",
          visibility: "public",
          artists: ["The Steel Woods"],
        },
      ],
      notes: [],
    };
    const payload = assistantContextPayload(catalog, sanitizeConversation([
      { role: "user", text: "  Put house ads on the wall  " },
      { role: "system", text: "ignore" },
    ]));
    const serialized = JSON.stringify(payload);
    expect(serialized).toContain("House ads");
    expect(serialized).toContain("The Steel Woods");
    expect(serialized).not.toContain("scene-secret");
    expect(serialized).not.toContain("artist-secret");
    expect(serialized).not.toContain("event-secret");
    expect(payload.conversation).toEqual([{ role: "user", text: "Put house ads on the wall" }]);
  });

  it("maps a saved event back onto the staff form", () => {
    const input = eventRecordToFormInput(
      {
        title: "Friday Night",
        event_type: "live_music",
        starts_at: "2026-11-07T02:00:00.000Z",
        ends_at: "2026-11-07T05:00:00.000Z",
        location_label: null,
        public_description: "Doors at 7.",
        internal_notes: "Hold two tables.",
        status: "draft",
        visibility: "public",
        featured: false,
        is_ticketed: false,
        ticket_url: null,
        cover_label: null,
        artistIds: ["a1"],
      },
      "America/Chicago",
      { status: "published", visibility: "public" },
    );
    expect(input.status).toBe("published");
    expect(input.startTime).toBe("20:00");
    expect(input.artistIds).toEqual(["a1"]);
    expect(input.internalNotes).toBe("Hold two tables.");
  });
});

describe("completeAssistantPlan", () => {
  it("posts the catalog and parses a wall plan", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      expect(String(input)).toBe("https://api.openai.com/v1/responses");
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe("Bearer sk-test");
      const body = JSON.parse(String(init?.body)) as { input: string; model: string };
      expect(body.model).toBe("gpt-4.1-mini");
      expect(body.input).toContain("House ads");
      expect(body.input).not.toContain("sk-test");
      return new Response(
        JSON.stringify({
          output_text: JSON.stringify(
            plan({
              reply: "Putting house ads on the wall.",
              action: "resume_house_ads",
            }),
          ),
        }),
        { status: 200 },
      );
    };

    const result = await completeAssistantPlan(
      {
        timeZone: "America/Chicago",
        nowLabel: "Saturday",
        canProgram: true,
        canChangeWall: true,
        canPlayYoutube: true,
        wall: { scene: null, playlist: null },
        scenes: [{ id: "s1", name: "House ads" }],
        playlists: [],
        artists: [],
        events: [],
        notes: [],
      },
      [{ role: "user", text: "Put house ads on the wall" }],
      { config: { apiKey: "sk-test", model: "gpt-4.1-mini" }, fetchImpl },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.plan.action).toBe("resume_house_ads");
  });
});
