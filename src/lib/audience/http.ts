import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUDIENCE_GUEST_COOKIE } from "@/lib/constants";
import { newAudienceGuestToken } from "@/lib/audience/engine";

export async function getOrCreateAudienceGuestToken() {
  const store = await cookies();
  const existing = store.get(AUDIENCE_GUEST_COOKIE)?.value;
  if (existing && existing.length >= 20) return existing;
  const token = newAudienceGuestToken();
  store.set(AUDIENCE_GUEST_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return token;
}

export async function readAudienceGuestToken() {
  const store = await cookies();
  const existing = store.get(AUDIENCE_GUEST_COOKIE)?.value;
  return existing && existing.length >= 20 ? existing : null;
}

export function publicAudienceJson(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
