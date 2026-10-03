import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { isSupabaseConfigured } from "@/lib/env";

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/access-denied",
  "/auth/callback",
  "/live-music",
  "/events",
  "/menu",
  "/catering",
  "/private-events",
  "/band-inquiries",
  "/our-story",
  "/contact",
  "/privacy-policy",
  "/suggestions",
  "/help",
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
    pathname.startsWith("/help") ||
    pathname.startsWith("/embed") ||
    pathname.startsWith("/overlay") ||
    pathname.startsWith("/display") ||
    pathname.startsWith("/print") ||
    pathname.startsWith("/tickets") ||
    pathname.startsWith("/t/") ||
    pathname.startsWith("/play") ||
    pathname.startsWith("/live") ||
    pathname.startsWith("/api/public");
  if (isPublic) {
    return response;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
