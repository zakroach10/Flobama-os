import { createClient } from "@supabase/supabase-js";
import { getPublicSupabaseEnv, getServiceRoleKey } from "@/lib/env";
import type { Database } from "@/lib/database.types";

export function createServiceRoleClient() {
  const env = getPublicSupabaseEnv();
  const serviceRoleKey = getServiceRoleKey();
  if (!env || !serviceRoleKey) return null;
  return createClient<Database>(env.url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const env = getPublicSupabaseEnv();
  const serviceRoleKey = getServiceRoleKey();
  if (!env || !serviceRoleKey) return null;

  const url = new URL("/auth/v1/admin/users", env.url);
  url.searchParams.set("email", email);
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { users?: Array<{ id?: string; email?: string }>; id?: string };
  if (payload.id) return payload.id;
  const match = (payload.users ?? []).find((user) => user.email?.toLowerCase() === email.toLowerCase());
  if (match?.id) return match.id;
  if (payload.users?.[0]?.id) return payload.users[0].id;

  const admin = createServiceRoleClient();
  if (!admin) return null;
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  return listed.data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
}
