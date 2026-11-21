import { createHmac, timingSafeEqual } from "node:crypto";
import { AUDIENCE_OBS_FPS, AUDIENCE_WALL_HEIGHT, AUDIENCE_WALL_WIDTH } from "@/lib/constants";
import type { AudienceObsBackground } from "@/lib/audience/types";
import { getCronSecret, getServiceRoleKey } from "@/lib/env";
import { joinPublicUrl } from "@/lib/public/urls";

const TOKEN_VERSION = 1;
const TOKEN_KIND = "audience-wall";
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
  return createHmac("sha256", secret).update(`flobama-audience-wall:v1:${body}`).digest("base64url");
}

export function canIssueAudienceWallShareTokens() {
  return Boolean(signingSecret());
}

/**
 * Stable, unguessable capability for one venue's audience wall.
 * The wall follows that venue's live session, so the link does not change
 * when a show ends and the next one starts. OBS keeps the same Browser Source.
 */
export function issueAudienceWallShareToken(venueId: string): string | null {
  const secret = signingSecret();
  if (!secret || !UUID_RE.test(venueId)) return null;
  const body = Buffer.from(
    JSON.stringify({ v: TOKEN_VERSION, kind: TOKEN_KIND, venueId } satisfies SharePayload),
    "utf8",
  ).toString("base64url");
  return `${body}~${signBody(body, secret)}`;
}

export function normalizeAudienceWallToken(token: string) {
  try {
    return decodeURIComponent(token);
  } catch {
    return token;
  }
}

export function verifyAudienceWallShareToken(
  token: string | null | undefined,
): { ok: true; venueId: string } | { ok: false } {
  const secret = signingSecret();
  if (!secret || !token || typeof token !== "string") return { ok: false };
  const normalized = normalizeAudienceWallToken(token.trim());
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

export function audienceObsBackground(value: string | null | undefined): AudienceObsBackground {
  return value === "transparent" ? "transparent" : "solid";
}

export function audienceWallPath(token: string, background: AudienceObsBackground = "solid") {
  const params = new URLSearchParams({ bg: background });
  return `/display/audience/${token}?${params.toString()}`;
}

export function audienceWallPollPath(token: string) {
  return `/api/public/v1/audience/wall/${encodeURIComponent(token)}`;
}

export function audienceWallShareUrl(
  origin: string,
  venueId: string,
  background: AudienceObsBackground = "solid",
): string | null {
  const token = issueAudienceWallShareToken(venueId);
  if (!token) return null;
  return joinPublicUrl(origin, audienceWallPath(token, background));
}

export const AUDIENCE_OBS_SETTINGS = {
  width: AUDIENCE_WALL_WIDTH,
  height: AUDIENCE_WALL_HEIGHT,
  fps: AUDIENCE_OBS_FPS,
} as const;
