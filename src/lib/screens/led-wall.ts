import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { DateTime } from "luxon";
import { DEFAULT_VENUE_TIMEZONE, LED_AGENT_STALE_MS } from "@/lib/constants";

export type LedWallSceneKind = "obs" | "media" | "trivia";
export type LedWallMediaKind = "image" | "video";

export type LedSceneRef = {
  id: string;
  kind: LedWallSceneKind;
  enabled: boolean;
  obsSceneName: string | null;
};

export type PublicLedMedia = {
  id: string;
  title: string;
  url: string;
  mediaKind: LedWallMediaKind;
};

export function blankToNull(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveDesiredObsScene(input: {
  activeScene: LedSceneRef | null;
  mediaObsSceneName: string | null;
}): string | null {
  if (!input.activeScene?.enabled) return null;
  if (input.activeScene.kind === "obs") return blankToNull(input.activeScene.obsSceneName);
  // Media uploads and trivia both render in the /display/led browser source.
  if (input.activeScene.kind === "media" || input.activeScene.kind === "trivia") {
    return blankToNull(input.mediaObsSceneName);
  }
  return null;
}

export function ledSceneDetail(scene: {
  kind: LedWallSceneKind | string;
  obs_scene_name?: string | null;
  media_kind?: string | null;
}) {
  if (scene.kind === "obs") return `OBS scene: ${scene.obs_scene_name}`;
  if (scene.kind === "trivia") {
    return "Automated trivia on the LED wall · QR join, questions, timer, top 3";
  }
  if (scene.media_kind === "video") return "MP4 loop on the FloBama display page";
  return "PNG on the FloBama display page";
}

export function toPublicLedMedia(row: {
  scene_id: string;
  title: string;
  public_url: string | null;
  media_kind: string | null;
} | null): PublicLedMedia | null {
  if (!row) return null;
  const url = blankToNull(row.public_url);
  if (!url) return null;
  if (row.media_kind !== "image" && row.media_kind !== "video") return null;
  const title = blankToNull(row.title) ?? "LED media";
  return { id: row.scene_id, title, url, mediaKind: row.media_kind };
}

export function hashLedAgentToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function ledAgentTokensMatch(storedHash: string, token: string) {
  const candidate = hashLedAgentToken(token);
  const stored = Buffer.from(storedHash);
  const next = Buffer.from(candidate);
  if (stored.length !== next.length) return false;
  return timingSafeEqual(stored, next);
}

export function createLedAgentToken() {
  return randomBytes(32).toString("base64url");
}

export function parseReportedObsScenes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const names: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed || trimmed.length > 200 || names.includes(trimmed)) continue;
    names.push(trimmed);
  }
  return names;
}

export function isMissingLedWallRelation(message: string | null | undefined) {
  return /led_wall_/i.test(message ?? "") && /does not exist|schema cache|could not find/i.test(message ?? "");
}

export function ledMediaKindForFile(file: { type: string; name: string }): LedWallMediaKind | null {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "mp4") return "video";
  if (ext === "png") return "image";
  if (file.type === "video/mp4") return "video";
  if (file.type === "image/png") return "image";
  return null;
}

export function formatAgentSeen(iso: string | null) {
  if (!iso) return "Booth client has not checked in yet.";
  const stamp = DateTime.fromISO(iso, { zone: "utc" }).setZone(DEFAULT_VENUE_TIMEZONE);
  if (!stamp.isValid) return "Booth client has not checked in yet.";
  return `Last check-in ${stamp.toFormat("MMM d, h:mm:ss a")}`;
}

export function isAgentStale(lastSeenAt: string | null, now: Date = new Date()) {
  if (!lastSeenAt) return true;
  const seen = Date.parse(lastSeenAt);
  return !Number.isFinite(seen) || now.getTime() - seen > LED_AGENT_STALE_MS;
}

export function agentStatusCopy(input: {
  lastSeenAt: string | null;
  obsConnected: boolean;
  programScene: string | null;
}) {
  if (!input.lastSeenAt) return "Booth client has not checked in yet.";
  const seen = formatAgentSeen(input.lastSeenAt);
  const program = blankToNull(input.programScene);
  if (!input.obsConnected) return `${seen} OBS was not connected.`;
  return program ? `${seen} OBS was connected. Program: ${program}.` : `${seen} OBS was connected.`;
}

export function describeAgentLink(input: {
  lastSeenAt: string | null;
  obsConnected: boolean;
  programScene: string | null;
  now?: Date;
}) {
  if (!input.lastSeenAt || isAgentStale(input.lastSeenAt, input.now)) {
    return input.lastSeenAt
      ? `${formatAgentSeen(input.lastSeenAt)} The booth client looks offline.`
      : "Booth client has not checked in yet.";
  }
  const seen = formatAgentSeen(input.lastSeenAt);
  const program = blankToNull(input.programScene);
  if (!input.obsConnected) return `${seen} OBS is not connected.`;
  return program ? `${seen} OBS is connected. Program: ${program}.` : `${seen} OBS is connected.`;
}
