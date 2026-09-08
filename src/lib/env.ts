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
