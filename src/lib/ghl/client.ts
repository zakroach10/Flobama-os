import { getGhlConfig, type GhlConfig } from "@/lib/env";

export const GHL_API_BASE = "https://services.leadconnectorhq.com";

export type GhlDeps = {
  config?: GhlConfig | null;
  fetchImpl?: typeof fetch;
};

export class GhlError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 0, code = "ghl_error") {
    super(message);
    this.name = "GhlError";
    this.status = status;
    this.code = code;
  }
}

export function ghlConfigured(config: GhlConfig | null | undefined = getGhlConfig()): config is GhlConfig {
  return Boolean(config?.token && config.locationId);
}

export function resolveGhlConfig(deps?: GhlDeps): GhlConfig | null {
  if (deps && "config" in deps) return deps.config ?? null;
  return getGhlConfig();
}

function joinUrl(path: string, searchParams?: Record<string, string | undefined>): string {
  const url = new URL(path.startsWith("http") ? path : `${GHL_API_BASE}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

function jsonErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const record = payload as Record<string, unknown>;
  const message = record.message ?? record.error ?? record.msg;
  if (typeof message === "string" && message.trim()) return message.trim();
  return fallback;
}

export type GhlRequestInit = {
  method?: string;
  body?: unknown;
  searchParams?: Record<string, string | undefined>;
  timeoutMs?: number;
};

export async function ghlFetch<T>(path: string, init: GhlRequestInit = {}, deps?: GhlDeps): Promise<T> {
  const config = resolveGhlConfig(deps);
  if (!ghlConfigured(config)) {
    throw new GhlError("GoHighLevel is not configured.", 0, "unconfigured");
  }

  const fetchImpl = deps?.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeoutMs = init.timeoutMs ?? 15_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${config.token}`,
    Version: config.apiVersion,
  };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";

  try {
    const response = await fetchImpl(joinUrl(path, init.searchParams), {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        payload = { message: text.slice(0, 240) };
      }
    }

    if (!response.ok) {
      throw new GhlError(
        jsonErrorMessage(payload, `GoHighLevel request failed (${response.status}).`),
        response.status,
        "http_error",
      );
    }

    return payload as T;
  } catch (error) {
    if (error instanceof GhlError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new GhlError("GoHighLevel request timed out.", 0, "timeout");
    }
    throw new GhlError("Could not reach GoHighLevel.", 0, "network");
  } finally {
    clearTimeout(timer);
  }
}

export async function listObjectSchemas(deps?: GhlDeps): Promise<unknown> {
  const config = resolveGhlConfig(deps);
  if (!ghlConfigured(config)) return { objects: [] };
  return ghlFetch("/objects/", { searchParams: { locationId: config.locationId } }, { ...deps, config });
}

export async function getObjectSchema(schemaKey: string, deps?: GhlDeps): Promise<unknown> {
  const config = resolveGhlConfig(deps);
  if (!ghlConfigured(config)) return null;
  return ghlFetch(`/objects/${encodeURIComponent(schemaKey)}`, { searchParams: { locationId: config.locationId } }, { ...deps, config });
}

export async function searchRecords(
  schemaKey: string,
  body: { locationId: string; page: number; pageLimit: number; query: string },
  deps?: GhlDeps,
): Promise<unknown> {
  return ghlFetch(`/objects/${encodeURIComponent(schemaKey)}/records/search`, { method: "POST", body }, deps);
}

export async function getRecord(schemaKey: string, recordId: string, deps?: GhlDeps): Promise<unknown> {
  const config = resolveGhlConfig(deps);
  if (!ghlConfigured(config)) return null;
  return ghlFetch(
    `/objects/${encodeURIComponent(schemaKey)}/records/${encodeURIComponent(recordId)}`,
    { searchParams: { locationId: config.locationId } },
    { ...deps, config },
  );
}

export async function updateRecord(
  schemaKey: string,
  recordId: string,
  properties: Record<string, string>,
  deps?: GhlDeps,
): Promise<unknown> {
  const config = resolveGhlConfig(deps);
  if (!ghlConfigured(config)) {
    throw new GhlError("GoHighLevel is not configured.", 0, "unconfigured");
  }
  return ghlFetch(
    `/objects/${encodeURIComponent(schemaKey)}/records/${encodeURIComponent(recordId)}`,
    {
      method: "PUT",
      body: { locationId: config.locationId, properties },
    },
    { ...deps, config },
  );
}
