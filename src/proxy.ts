import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { isSupabaseConfigured } from "@/lib/env";

const PUBLIC_PATHS = new Set([
  "/login",
  "/forgot-password",
  "/reset-password",
  "/access-denied",
  "/auth/callback",
]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = await updateSession(request);

  if (!isSupabaseConfigured()) {
    return response;
  }

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return response;
  }

  const isPublic =
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/embed") ||
    pathname.startsWith("/overlay") ||
    pathname.startsWith("/display") ||
    pathname.startsWith("/print") ||
    pathname.startsWith("/tickets") ||
    pathname.startsWith("/t/") ||
    pathname.startsWith("/api/public");
  if (isPublic) {
    return response;
  }

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
