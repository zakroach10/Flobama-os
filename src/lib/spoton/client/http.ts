export class SpotOnHttpError extends Error {
  status: number;
  retryable: boolean;
  bodyText: string;

  constructor(message: string, status: number, bodyText: string) {
    super(message);
    this.name = "SpotOnHttpError";
    this.status = status;
    this.bodyText = bodyText.slice(0, 500);
    this.retryable = status === 429 || status >= 500;
  }
}

export async function spotonFetchJson<T>(input: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  retries?: number;
}): Promise<T> {
  const retries = input.retries ?? 3;
  const timeoutMs = input.timeoutMs ?? 20_000;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(input.url, {
        method: input.method ?? "GET",
        headers: input.headers,
        body: input.body,
        signal: controller.signal,
      });
      const text = await response.text();
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "2");
        lastError = new SpotOnHttpError("SpotOn rate limited", 429, text);
        await sleep(Math.min(30_000, Math.max(1000, retryAfter * 1000) * (attempt + 1)));
        continue;
      }
      if (!response.ok) {
        const err = new SpotOnHttpError(
          `SpotOn HTTP ${response.status}`,
          response.status,
          text,
        );
        if (!err.retryable || attempt === retries) throw err;
        lastError = err;
        await sleep(500 * 2 ** attempt);
        continue;
      }
      if (!text) return {} as T;
      return JSON.parse(text) as T;
    } catch (error) {
      if (error instanceof SpotOnHttpError) {
        if (!error.retryable || attempt === retries) throw error;
        lastError = error;
      } else {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt === retries) throw lastError;
      }
      await sleep(500 * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? new Error("SpotOn request failed");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function toRfc3339NoMillis(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}
