import { NextResponse } from "next/server";

export const PUBLIC_CACHE = "public, s-maxage=60, stale-while-revalidate=300";
export const PUBLIC_NO_STORE = "private, no-store, no-cache, must-revalidate";

export function withPublicHeaders(response: NextResponse, cache = PUBLIC_CACHE) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  response.headers.set("Cache-Control", cache);
  return response;
}

export function publicJson(body: unknown, status = 200, cache = PUBLIC_CACHE) {
  return withPublicHeaders(NextResponse.json(body, { status }), cache);
}

export function publicOptions() {
  return withPublicHeaders(new NextResponse(null, { status: 204 }));
}
