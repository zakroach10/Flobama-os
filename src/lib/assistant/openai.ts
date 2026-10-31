import type { OpenAiConfig } from "@/lib/env";
import {
  ASSISTANT_RESPONSE_SCHEMA,
  assistantContextPayload,
  buildAssistantInstructions,
  parseAssistantPlan,
  type AssistantCatalog,
  type AssistantPlan,
  type AssistantTurn,
} from "@/lib/assistant/plan";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_TIMEOUT_MS = 25_000;
const MAX_OUTPUT_TOKENS = 900;

export type CompleteAssistantDeps = {
  config: OpenAiConfig;
  fetchImpl?: typeof fetch;
};

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
  return null;
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const fenced = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    return JSON.parse(fenced) as unknown;
  }
}

export async function completeAssistantPlan(
  catalog: AssistantCatalog,
  turns: AssistantTurn[],
  deps: CompleteAssistantDeps,
): Promise<{ ok: true; plan: AssistantPlan } | { ok: false; message: string }> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetchImpl(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${deps.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: deps.config.model,
        instructions: buildAssistantInstructions(),
        input: JSON.stringify(assistantContextPayload(catalog, turns)),
        max_output_tokens: MAX_OUTPUT_TOKENS,
        text: {
          format: {
            type: "json_schema",
            name: "staff_assistant_plan",
            strict: true,
            schema: ASSISTANT_RESPONSE_SCHEMA,
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
      return { ok: false, message };
    }

    const outputText = extractResponseText(body);
    if (!outputText) return { ok: false, message: "The assistant returned an empty reply." };
    let parsedJson: unknown;
    try {
      parsedJson = parseJsonObject(outputText);
    } catch {
      return { ok: false, message: "The assistant returned invalid JSON." };
    }
    const plan = parseAssistantPlan(parsedJson);
    if (!plan) return { ok: false, message: "The assistant returned an incomplete plan." };
    return { ok: true, plan };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, message: "The assistant took too long. Try a shorter request." };
    }
    return { ok: false, message: "The assistant could not be reached." };
  } finally {
    clearTimeout(timer);
  }
}
