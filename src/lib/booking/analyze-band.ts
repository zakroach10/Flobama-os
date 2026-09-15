import { getOpenAiConfig, type OpenAiConfig } from "@/lib/env";
import type { BookingRecord } from "@/lib/ghl/objects";

export const BAND_FIT_VERDICTS = ["strong_fit", "possible_fit", "weak_fit", "insufficient_data"] as const;
export type BandFitVerdict = (typeof BAND_FIT_VERDICTS)[number];

export type BandFitSignals = {
  onlinePresence: string;
  following: string;
  draw: string;
  compensation: string;
  localFit: string;
};

export type BandFitAnalysis = {
  verdict: BandFitVerdict;
  score: number;
  summary: string;
  strengths: string[];
  risks: string[];
  signals: BandFitSignals;
};

export type BandFitAnalysisResult =
  | { configured: false }
  | { configured: true; analysis: BandFitAnalysis }
  | { configured: true; analysis: null; error: string };

export type BandFitPromptPayload = {
  venue: {
    name: string;
    city: string;
    context: string;
  };
  band: {
    name: string;
    genre: string | null;
    homeCity: string | null;
    website: string | null;
    facebook: string | null;
    instagram: string | null;
    youtube: string | null;
    spotify: string | null;
    epk: string | null;
    numberOfPerformers: string | null;
    typicalPerformanceLength: string | null;
    availableDates: string | null;
    expectedCompensation: string | null;
    typicalDraw: string | null;
    previouslyPlayedFlobama: string | null;
    productionRequirements: string | null;
    artistBiography: string | null;
    additionalInformation: string | null;
  };
};

export type AnalyzeBandDeps = {
  config?: OpenAiConfig | null;
  fetchImpl?: typeof fetch;
};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_TIMEOUT_MS = 25_000;
const MAX_OUTPUT_TOKENS = 700;

const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["verdict", "score", "summary", "strengths", "risks", "signals"],
  properties: {
    verdict: { type: "string", enum: [...BAND_FIT_VERDICTS] },
    score: { type: "integer", minimum: 0, maximum: 100 },
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" }, maxItems: 5 },
    risks: { type: "array", items: { type: "string" }, maxItems: 5 },
    signals: {
      type: "object",
      additionalProperties: false,
      required: ["onlinePresence", "following", "draw", "compensation", "localFit"],
      properties: {
        onlinePresence: { type: "string" },
        following: { type: "string" },
        draw: { type: "string" },
        compensation: { type: "string" },
        localFit: { type: "string" },
      },
    },
  },
} as const;

function fieldValue(record: BookingRecord, key: string): string | null {
  return record.inquiry?.fields.find((field) => field.key === key)?.value ?? null;
}

export function buildBandFitPromptPayload(record: BookingRecord): BandFitPromptPayload {
  return {
    venue: {
      name: "FloBama Music Hall",
      city: "Mobile, AL",
      context:
        "Downtown Mobile live-music venue. Staff use this analysis as an advisory booking desk note — not an automatic decision. Prefer acts with a realistic local/regional draw, workable production needs, and compensation that fits a mid-size club.",
    },
    band: {
      name: record.displayName,
      genre: record.inquiry?.genre ?? null,
      homeCity: record.inquiry?.homeCity ?? null,
      website: fieldValue(record, "website"),
      facebook: fieldValue(record, "facebook"),
      instagram: fieldValue(record, "instagram"),
      youtube: fieldValue(record, "youtube"),
      spotify: fieldValue(record, "spotifystreaming"),
      epk: fieldValue(record, "electronic_press_kit_epk"),
      numberOfPerformers: fieldValue(record, "number_of_performers"),
      typicalPerformanceLength: fieldValue(record, "typical_performance_length"),
      availableDates: record.requestedDates ?? fieldValue(record, "available_dates"),
      expectedCompensation: record.compensation ?? fieldValue(record, "expected_compensation"),
      typicalDraw: fieldValue(record, "typical_draw"),
      previouslyPlayedFlobama: fieldValue(record, "previously_played_flobama"),
      productionRequirements: fieldValue(record, "production_requirements"),
      artistBiography: fieldValue(record, "artist_biography"),
      additionalInformation: fieldValue(record, "additional_information"),
    },
  };
}

export function buildBandFitInstructions(): string {
  return [
    "You are helping FloBama Music Hall staff evaluate a band submission for booking fit.",
    "Use ONLY the provided GHL Band Inquiry fields. Do not invent follower counts, streams, press, or reviews.",
    "When follower/stream counts are not in the payload, say they are unknown in signals.following and onlinePresence.",
    "Social/EPK values may be URLs or handles — treat them as presence signals only, not verified metrics.",
    "Return concise staff-facing language. strengths and risks should be short bullets.",
    "score is 0-100 overall booking fit for FloBama. Use insufficient_data when too little is present to judge.",
  ].join(" ");
}

function clampScore(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function asStringArray(value: unknown, max = 5): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, max);
}

function asSignal(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function parseBandFitAnalysis(raw: unknown): BandFitAnalysis | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const verdict = record.verdict;
  if (typeof verdict !== "string" || !(BAND_FIT_VERDICTS as readonly string[]).includes(verdict)) return null;
  const signalsRaw = record.signals && typeof record.signals === "object" ? (record.signals as Record<string, unknown>) : {};
  const summary = typeof record.summary === "string" ? record.summary.trim() : "";
  if (!summary) return null;
  return {
    verdict: verdict as BandFitVerdict,
    score: clampScore(record.score),
    summary,
    strengths: asStringArray(record.strengths),
    risks: asStringArray(record.risks),
    signals: {
      onlinePresence: asSignal(signalsRaw.onlinePresence, "Unknown from provided fields."),
      following: asSignal(signalsRaw.following, "Follower counts unknown from provided fields."),
      draw: asSignal(signalsRaw.draw, "Typical draw unknown from provided fields."),
      compensation: asSignal(signalsRaw.compensation, "Compensation unknown from provided fields."),
      localFit: asSignal(signalsRaw.localFit, "Local fit unclear from provided fields."),
    },
  };
}

function extractResponseText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.output_text === "string" && record.output_text.trim()) return record.output_text.trim();
  if (Array.isArray(record.output)) {
    const chunks: string[] = [];
    for (const item of record.output) {
      if (!item || typeof item !== "object") continue;
      const content = (item as Record<string, unknown>).content;
      if (!Array.isArray(content)) continue;
      for (const part of content) {
        if (!part || typeof part !== "object") continue;
        const text = (part as Record<string, unknown>).text;
        if (typeof text === "string" && text.trim()) chunks.push(text.trim());
      }
    }
    if (chunks.length) return chunks.join("\n");
  }
  if (typeof record.content === "string" && record.content.trim()) return record.content.trim();
  return null;
}

function resolveConfig(deps?: AnalyzeBandDeps): OpenAiConfig | null {
  if (deps && "config" in deps) return deps.config ?? null;
  return getOpenAiConfig();
}

export async function analyzeBandFit(record: BookingRecord, deps?: AnalyzeBandDeps): Promise<BandFitAnalysisResult> {
  const config = resolveConfig(deps);
  if (!config) return { configured: false };

  const payload = buildBandFitPromptPayload(record);
  const fetchImpl = deps?.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetchImpl(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        instructions: buildBandFitInstructions(),
        input: JSON.stringify(payload),
        max_output_tokens: MAX_OUTPUT_TOKENS,
        text: {
          format: {
            type: "json_schema",
            name: "band_fit_analysis",
            strict: true,
            schema: ANALYSIS_SCHEMA,
          },
        },
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = { message: text.slice(0, 240) };
      }
    }

    if (!response.ok) {
      const message =
        body && typeof body === "object" && typeof (body as { error?: { message?: string } }).error?.message === "string"
          ? (body as { error: { message: string } }).error.message
          : `OpenAI request failed (${response.status}).`;
      return { configured: true, analysis: null, error: message };
    }

    const outputText = extractResponseText(body);
    if (!outputText) return { configured: true, analysis: null, error: "OpenAI returned an empty analysis." };

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(outputText) as unknown;
    } catch {
      return { configured: true, analysis: null, error: "OpenAI returned invalid analysis JSON." };
    }

    const analysis = parseBandFitAnalysis(parsedJson);
    if (!analysis) return { configured: true, analysis: null, error: "OpenAI returned an incomplete analysis." };
    return { configured: true, analysis };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { configured: true, analysis: null, error: "OpenAI analysis timed out." };
    }
    return {
      configured: true,
      analysis: null,
      error: error instanceof Error ? error.message : "Could not reach OpenAI.",
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function analyzeBandFits(
  records: BookingRecord[],
  deps?: AnalyzeBandDeps,
  concurrency = 3,
): Promise<Record<string, BandFitAnalysisResult>> {
  const config = resolveConfig(deps);
  const out: Record<string, BandFitAnalysisResult> = {};
  if (!config) {
    for (const record of records) out[record.id] = { configured: false };
    return out;
  }

  const unique = records.filter((record) => record.id);
  for (let i = 0; i < unique.length; i += concurrency) {
    const slice = unique.slice(i, i + concurrency);
    const batch = await Promise.all(
      slice.map(async (record) => [record.id, await analyzeBandFit(record, { ...deps, config })] as const),
    );
    for (const [id, result] of batch) out[id] = result;
  }
  return out;
}
