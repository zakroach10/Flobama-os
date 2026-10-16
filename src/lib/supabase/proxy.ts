import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { withPersistentAuthCookieOptions } from "@/lib/auth/session-cookies";
import { getPublicSupabaseEnv } from "@/lib/env";
import type { Database } from "@/lib/database.types";

function nextWithPathname(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export async function updateSession(request: NextRequest) {
  const env = getPublicSupabaseEnv();
  if (!env) {
    return nextWithPathname(request);
  }

  let supabaseResponse = nextWithPathname(request);

  const supabase = createServerClient<Database>(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = nextWithPathname(request);
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, withPersistentAuthCookieOptions(options));
        });
      },
    },
  });

  // Refresh the session when a valid refresh token is present so installed PWAs
  // keep working after access-token expiry without forcing a password prompt.
  await supabase.auth.getUser();
  return supabaseResponse;
}
