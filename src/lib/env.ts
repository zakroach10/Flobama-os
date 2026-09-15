import type { RequiredPublicEnvName } from "@/lib/constants";
import { normalizeOrigin, PRODUCTION_SITE_URL } from "@/lib/public/urls";

export type PublicSupabaseEnv = {
  url: string;
  anonKey: string;
};

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value || value.trim() === "") return undefined;
  return value.trim();
}

function readPublicSupabaseUrl() {
  // Next only inlines NEXT_PUBLIC_* when the key is a static property access.
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || undefined;
}

function readPublicSupabaseAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || undefined;
}

export function missingPublicEnvNames(): RequiredPublicEnvName[] {
  const missing: RequiredPublicEnvName[] = [];
  if (!readPublicSupabaseUrl()) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!readPublicSupabaseAnonKey()) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return missing;
}

export function isSupabaseConfigured(): boolean {
  return missingPublicEnvNames().length === 0;
}

export function getPublicSupabaseEnv(): PublicSupabaseEnv | null {
  const url = readPublicSupabaseUrl();
  const anonKey = readPublicSupabaseAnonKey();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function getServiceRoleKey(): string | null {
  return readEnv("SUPABASE_SERVICE_ROLE_KEY") ?? null;
}

export function isServiceRoleConfigured(): boolean {
  return Boolean(getPublicSupabaseEnv() && getServiceRoleKey());
}

export function getSiteUrl(): string {
  const explicit = normalizeOrigin(readEnv("NEXT_PUBLIC_SITE_URL"));
  if (explicit) return explicit;
  const vercelProduction = normalizeOrigin(readEnv("VERCEL_PROJECT_PRODUCTION_URL"));
  if (vercelProduction) return vercelProduction;
  const vercel = normalizeOrigin(readEnv("VERCEL_URL"));
  if (vercel) return vercel;
  return "http://localhost:43123";
}

export function getPublicAppUrl(): string {
  return normalizeOrigin(readEnv("NEXT_PUBLIC_SITE_URL")) ?? PRODUCTION_SITE_URL;
}

export const DEFAULT_GHL_API_VERSION = "2021-07-28";

export type GhlConfig = {
  token: string;
  locationId: string;
  apiVersion: string;
  socialUserId?: string;
  objectKeys: {
    bandSubmission?: string;
    privateEvents?: string;
  };
};

export function getGhlConfig(): GhlConfig | null {
  const token = readEnv("GHL_PRIVATE_TOKEN");
  const locationId = readEnv("GHL_LOCATION_ID");
  if (!token || !locationId) return null;
  return {
    token,
    locationId,
    apiVersion: readEnv("GHL_API_VERSION") ?? DEFAULT_GHL_API_VERSION,
    socialUserId: readEnv("GHL_SOCIAL_USER_ID"),
    objectKeys: {
      bandSubmission: readEnv("GHL_OBJECT_BAND_SUBMISSION"),
      privateEvents: readEnv("GHL_OBJECT_PRIVATE_EVENTS"),
    },
  };
}

export function isGhlConfigured(): boolean {
  return getGhlConfig() !== null;
}

export const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";

export type OpenAiConfig = {
  apiKey: string;
  model: string;
};

function readOpenAiApiKey(): string | undefined {
  // Static access so Next/Vercel reliably expose the secret on the server runtime.
  return process.env.OPENAI_API_KEY?.trim() || undefined;
}

function readOpenAiModel(): string | undefined {
  return process.env.OPENAI_MODEL?.trim() || undefined;
}

export function getOpenAiConfig(): OpenAiConfig | null {
  const apiKey = readOpenAiApiKey();
  if (!apiKey) return null;
  return {
    apiKey,
    model: readOpenAiModel() ?? DEFAULT_OPENAI_MODEL,
  };
}

export function isOpenAiConfigured(): boolean {
  return getOpenAiConfig() !== null;
}
