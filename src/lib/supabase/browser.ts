import { createBrowserClient } from "@supabase/ssr";
import { AUTH_COOKIE_MAX_AGE_SECONDS } from "@/lib/auth/session-cookies";
import { getPublicSupabaseEnv } from "@/lib/env";
import type { Database } from "@/lib/database.types";

export function createBrowserSupabaseClient(env = getPublicSupabaseEnv()) {
  if (!env) return null;
  return createBrowserClient<Database>(env.url, env.anonKey, {
    cookieOptions: {
      path: "/",
      sameSite: "lax",
      maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}
