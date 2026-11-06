import { createHmac, timingSafeEqual } from "node:crypto";
import { getCronSecret, getServiceRoleKey } from "@/lib/env";
import { joinPublicUrl } from "@/lib/public/urls";

const TOKEN_VERSION = 1;
const TOKEN_KIND = "trivia-wall";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SharePayload = {
  v: number;
  kind: string;
  venueId: string;
};

function signingSecret(): string | null {
  return getCronSecret() || getServiceRoleKey();
}

function signBody(body: string, secret: string) {
  return createHmac("sha256", secret).update(`flobama-trivia-wall:v1:${body}`).digest("base64url");
}

export function canIssueTriviaWallShareTokens() {
  return Boolean(signingSecret());
}

/**
 * Stable, unguessable capability for one venue's trivia output.
 * Trivia is a single live session per venue (not per event), so the token
 * does not change when a new game starts. OBS can keep the same Browser Source.
 * Rotating CRON_SECRET — or the service role key when CRON_SECRET is unset —
 * invalidates every link.
 */
export function issueTriviaWallShareToken(venueId: string): string | null {
  const secret = signingSecret();
  if (!secret || !UUID_RE.test(venueId)) return null;
  const body = Buffer.from(
    JSON.stringify({ v: TOKEN_VERSION, kind: TOKEN_KIND, venueId } satisfies SharePayload),
    "utf8",
  ).toString("base64url");
  return `${body}~${signBody(body, secret)}`;
}

export function normalizeTriviaWallToken(token: string) {
  try {
    return decodeURIComponent(token);
  } catch {
    return token;
  }
}

export function verifyTriviaWallShareToken(
  token: string | null | undefined,
): { ok: true; venueId: string } | { ok: false } {
  const secret = signingSecret();
  if (!secret || !token || typeof token !== "string") return { ok: false };
  const normalized = normalizeTriviaWallToken(token.trim());
  const splitAt = normalized.lastIndexOf("~");
  if (splitAt <= 0 || splitAt === normalized.length - 1) return { ok: false };
  const body = normalized.slice(0, splitAt);
  const signature = normalized.slice(splitAt + 1);
  if (!/^[A-Za-z0-9_-]+$/.test(body) || !/^[A-Za-z0-9_-]+$/.test(signature)) return { ok: false };

  const expected = signBody(body, secret);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return { ok: false };

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SharePayload;
    if (parsed?.v !== TOKEN_VERSION || parsed.kind !== TOKEN_KIND || !UUID_RE.test(parsed.venueId ?? "")) {
      return { ok: false };
    }
    return { ok: true, venueId: parsed.venueId };
  } catch {
    return { ok: false };
  }
}

export function triviaWallPath(token: string) {
  return `/wall/${token}`;
}

export function triviaWallPollPath(token: string) {
  return `/api/public/v1/trivia/wall/${encodeURIComponent(token)}`;
}

export function triviaWallShareUrl(origin: string, venueId: string): string | null {
  const token = issueTriviaWallShareToken(venueId);
  if (!token) return null;
  return joinPublicUrl(origin, triviaWallPath(token));
}
