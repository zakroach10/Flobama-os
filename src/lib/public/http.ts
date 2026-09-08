import { NextResponse } from "next/server";

export const PUBLIC_CACHE = "public, s-maxage=60, stale-while-revalidate=300";

export function withPublicHeaders(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  response.headers.set("Cache-Control", PUBLIC_CACHE);
  return response;
}

export function publicJson(body: unknown, status = 200) {
  return withPublicHeaders(NextResponse.json(body, { status }));
}

export function publicOptions() {
  return withPublicHeaders(new NextResponse(null, { status: 204 }));
}
