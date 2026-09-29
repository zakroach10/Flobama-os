import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { TRIVIA_PLAYER_COOKIE } from "@/lib/constants";
import { newPlayerToken } from "@/lib/trivia/engine";

export async function getOrCreateTriviaPlayerToken() {
  const store = await cookies();
  const existing = store.get(TRIVIA_PLAYER_COOKIE)?.value;
  if (existing && existing.length >= 20) return existing;
  const token = newPlayerToken();
  store.set(TRIVIA_PLAYER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 6,
  });
  return token;
}

export async function readTriviaPlayerToken() {
  const store = await cookies();
  const existing = store.get(TRIVIA_PLAYER_COOKIE)?.value;
  return existing && existing.length >= 20 ? existing : null;
}

export function publicTriviaJson(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
