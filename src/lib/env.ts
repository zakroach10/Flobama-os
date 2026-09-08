import { REQUIRED_PUBLIC_ENV, type RequiredPublicEnvName } from "@/lib/constants";

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

export function getSiteUrl(): string {
  return (
    readEnv("NEXT_PUBLIC_SITE_URL") ??
    readEnv("NEXT_PUBLIC_VERCEL_URL")?.replace(/^/, "https://") ??
    "http://localhost:43123"
  );
}
