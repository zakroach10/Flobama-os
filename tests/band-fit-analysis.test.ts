import { afterEach, describe, expect, it } from "vitest";
import { getOpenAiConfig, isOpenAiConfigured } from "@/lib/env";
import {
  analyzeBandFit,
  analyzeBandFits,
  buildBandFitPromptPayload,
  parseBandFitAnalysis,
} from "@/lib/booking/analyze-band";
import type { BookingRecord } from "@/lib/ghl/objects";

const ENV_KEYS = ["OPENAI_API_KEY", "OPENAI_MODEL"] as const;
const originalEnv: Record<string, string | undefined> = {};
for (const key of ENV_KEYS) originalEnv[key] = process.env[key];

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

function sampleRecord(): BookingRecord {
  return {
    id: "rec_1",
    schemaKey: "custom_objects.band_inquiries",
    displayName: "The River Band",
    contactName: "Alex Rivera",
    email: "alex@example.com",
    phone: "2515550100",
    contactId: "contact_1",
    contactLinkStatus: "linked",
    contactLinkMessage: null,
    requestedDates: "Oct 3–4",
    compensation: "$1,200",
    status: "New",
    notes: null,
    updatedAt: "2026-09-15T18:00:00.000Z",
    createdAt: null,
    properties: {},
    statusOptions: ["New"],
    statusFieldKey: "booking_status",
    notesFieldKey: null,
    inquiry: {
      contactName: "Alex Rivera",
      genre: "Americana",
      homeCity: "Mobile, AL",
      compensation: "$1,200",
      availableDates: "Oct 3–4",
      fields: [
        { key: "genre", label: "Genre", value: "Americana", href: null, section: "profile" },
        { key: "home_city__state", label: "Home city / state", value: "Mobile, AL", href: null, section: "profile" },
        { key: "instagram", label: "Instagram", value: "@rivertown", href: "https://instagram.com/rivertown", section: "links" },
        { key: "spotifystreaming", label: "Spotify / streaming", value: "https://open.spotify.com/artist/example", href: "https://open.spotify.com/artist/example", section: "links" },
        { key: "electronic_press_kit_epk", label: "Electronic press kit (EPK)", value: "https://example.com/epk", href: "https://example.com/epk", section: "links" },
        { key: "typical_draw", label: "Typical draw", value: "80–120", href: null, section: "booking" },
        { key: "expected_compensation", label: "Expected compensation", value: "$1,200", href: null, section: "booking" },
        { key: "available_dates", label: "Available dates", value: "Oct 3–4", href: null, section: "booking" },
        { key: "artist_biography", label: "Artist biography", value: "Gulf Coast americana trio.", href: null, section: "about" },
      ],
    },
  };
}

describe("openai configuration", () => {
  it("is off when OPENAI_API_KEY is missing", () => {
    delete process.env.OPENAI_API_KEY;
    expect(getOpenAiConfig()).toBeNull();
    expect(isOpenAiConfigured()).toBe(false);
  });

  it("reads api key and optional model", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.OPENAI_MODEL = "gpt-4.1";
    expect(getOpenAiConfig()).toEqual({ apiKey: "sk-test", model: "gpt-4.1" });
    expect(isOpenAiConfigured()).toBe(true);
  });
});

describe("band fit prompt mapping", () => {
  it("builds a payload from GHL Band Inquiry fields only", () => {
    const payload = buildBandFitPromptPayload(sampleRecord());
    expect(payload.venue.name).toBe("FloBama Music Hall");
    expect(payload.band).toMatchObject({
      name: "The River Band",
      genre: "Americana",
      homeCity: "Mobile, AL",
      instagram: "@rivertown",
      spotify: "https://open.spotify.com/artist/example",
      epk: "https://example.com/epk",
      expectedCompensation: "$1,200",
      typicalDraw: "80–120",
      availableDates: "Oct 3–4",
      artistBiography: "Gulf Coast americana trio.",
    });
    expect(JSON.stringify(payload)).not.toContain("sk-");
  });
});

describe("parseBandFitAnalysis", () => {
  it("accepts a valid structured analysis", () => {
    const analysis = parseBandFitAnalysis({
      verdict: "possible_fit",
      score: 72,
      summary: "Local americana act with workable draw and compensation.",
      strengths: ["Local to Mobile", "Listed draw of 80–120"],
      risks: ["Follower counts unknown"],
      signals: {
        onlinePresence: "Instagram and Spotify links provided; metrics unknown.",
        following: "Follower counts unknown from provided fields.",
        draw: "Self-reported draw 80–120.",
        compensation: "$1,200 asked.",
        localFit: "Home city Mobile, AL.",
      },
    });
    expect(analysis?.verdict).toBe("possible_fit");
    expect(analysis?.score).toBe(72);
    expect(analysis?.strengths).toHaveLength(2);
  });

  it("rejects incomplete payloads", () => {
    expect(parseBandFitAnalysis({ verdict: "nope", score: 10, summary: "x" })).toBeNull();
    expect(parseBandFitAnalysis({ verdict: "strong_fit", score: 10 })).toBeNull();
  });
});

describe("analyzeBandFit", () => {
  it("skips the network when OpenAI is unconfigured", async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new Error("network should not run");
    };
    const result = await analyzeBandFit(sampleRecord(), { config: null, fetchImpl });
    expect(result).toEqual({ configured: false });
  });

  it("posts a Responses API request and parses structured JSON", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      expect(String(input)).toBe("https://api.openai.com/v1/responses");
      expect(init?.method).toBe("POST");
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe("Bearer sk-test");
      const body = JSON.parse(String(init?.body)) as {
        model: string;
        input: string;
        max_output_tokens: number;
      };
      expect(body.model).toBe("gpt-4.1-mini");
      expect(body.max_output_tokens).toBeLessThanOrEqual(700);
      expect(body.input).toContain("The River Band");
      expect(body.input).toContain("Americana");
      return new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            verdict: "strong_fit",
            score: 84,
            summary: "Strong local fit with clear draw and presence links.",
            strengths: ["Local act", "Draw listed"],
            risks: ["No verified follower metrics"],
            signals: {
              onlinePresence: "Social and EPK links present.",
              following: "Follower counts unknown from provided fields.",
              draw: "80–120.",
              compensation: "$1,200.",
              localFit: "Mobile, AL.",
            },
          }),
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    const result = await analyzeBandFit(sampleRecord(), {
      config: { apiKey: "sk-test", model: "gpt-4.1-mini" },
      fetchImpl,
    });
    expect(result.configured).toBe(true);
    if (!result.configured || !result.analysis) throw new Error("expected analysis");
    expect(result.analysis.verdict).toBe("strong_fit");
    expect(result.analysis.score).toBe(84);
    expect(JSON.stringify(result)).not.toContain("sk-test");
  });

  it("returns a non-blocking error when OpenAI fails", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ error: { message: "quota exceeded" } }), {
        status: 429,
        headers: { "content-type": "application/json" },
      });
    const result = await analyzeBandFit(sampleRecord(), {
      config: { apiKey: "sk-test", model: "gpt-4.1-mini" },
      fetchImpl,
    });
    expect(result).toEqual({ configured: true, analysis: null, error: "quota exceeded" });
  });

  it("analyzes a list of submissions with limited concurrency", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchImpl: typeof fetch = async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            verdict: "possible_fit",
            score: 70,
            summary: "Possible fit.",
            strengths: ["Local"],
            risks: ["Unknown following"],
            signals: {
              onlinePresence: "Links present.",
              following: "Unknown.",
              draw: "Unknown.",
              compensation: "Unknown.",
              localFit: "Local.",
            },
          }),
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    const first = sampleRecord();
    const second = { ...sampleRecord(), id: "rec_2", displayName: "Second Band" };
    const third = { ...sampleRecord(), id: "rec_3", displayName: "Third Band" };
    const results = await analyzeBandFits([first, second, third], {
      config: { apiKey: "sk-test", model: "gpt-4.1-mini" },
      fetchImpl,
    }, 2);
    expect(Object.keys(results)).toEqual(["rec_1", "rec_2", "rec_3"]);
    expect(results.rec_1?.configured && results.rec_1.analysis?.score).toBe(70);
    expect(maxInFlight).toBeLessThanOrEqual(2);
  });
});
