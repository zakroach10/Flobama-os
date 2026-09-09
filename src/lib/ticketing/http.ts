import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { TICKETING_SESSION_COOKIE } from "@/lib/ticketing/constants";
import { newCheckoutSessionToken } from "@/lib/ticketing/tokens";

export async function getOrCreateTicketSession() {
  const store = await cookies();
  const existing = store.get(TICKETING_SESSION_COOKIE)?.value;
  if (existing && existing.length >= 16) return existing;
  const token = newCheckoutSessionToken();
  store.set(TICKETING_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return token;
}

export function publicTicketingJson(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
