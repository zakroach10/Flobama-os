import { createClient } from "@supabase/supabase-js";
import { getPublicSupabaseEnv } from "@/lib/env";
import type { Database } from "@/lib/database.types";

export function createAnonSupabaseClient() {
  const env = getPublicSupabaseEnv();
  if (!env) return null;
  return createClient<Database>(env.url, env.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
