import { REQUIRED_PUBLIC_ENV, type RequiredPublicEnvName } from "@/lib/constants";
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

export function missingPublicEnvNames(): RequiredPublicEnvName[] {
  return REQUIRED_PUBLIC_ENV.filter((name) => !readEnv(name));
}

export function isSupabaseConfigured(): boolean {
  return missingPublicEnvNames().length === 0;
}

export function getPublicSupabaseEnv(): PublicSupabaseEnv | null {
  const url = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
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
