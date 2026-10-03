import { randomBytes } from "node:crypto";
import type {
  AudienceCornerPosition,
  AudienceCornerSponsor,
  AudienceToolKind,
  AudienceVoteTally,
} from "@/lib/audience/types";
import { AUDIENCE_CORNER_POSITIONS, AUDIENCE_TOOL_KINDS } from "@/lib/audience/types";

export function isAudienceToolKind(value: string): value is AudienceToolKind {
  return (AUDIENCE_TOOL_KINDS as readonly string[]).includes(value);
}

export function isAudienceCornerPosition(value: string): value is AudienceCornerPosition {
  return (AUDIENCE_CORNER_POSITIONS as readonly string[]).includes(value);
}

export function cornerSponsorForWall(input: {
  enabled?: boolean | null;
  name?: string | null;
  imageUrl?: string | null;
  corner?: string | null;
  phone?: string | null;
  message?: string | null;
} | null | undefined): AudienceCornerSponsor | null {
  if (!input?.enabled) return null;
  const name = (input.name ?? "").trim().slice(0, 80);
  const imageUrl = (input.imageUrl ?? "").trim() || null;
  if (!name && !imageUrl) return null;
  const corner = input.corner && isAudienceCornerPosition(input.corner) ? input.corner : "bottom-left";
  return {
    name,
    imageUrl,
    corner,
    phone: (input.phone ?? "").trim().slice(0, 40),
    message: (input.message ?? "").trim().slice(0, 120),
  };
}

export function createAudienceJoinCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[bytes[i]! % alphabet.length];
  }
  return code;
}

export function newAudienceGuestToken() {
  return randomBytes(24).toString("base64url");
}

export function normalizeAudienceDisplayName(raw: string) {
  return raw.trim().replace(/\s+/g, " ").slice(0, 24);
}

export function isMissingAudienceRelation(message: string | null | undefined) {
  return /audience_/i.test(message ?? "") && /does not exist|schema cache|could not find/i.test(message ?? "");
}

export function choiceLabelsForTool(kind: AudienceToolKind, payload: Record<string, unknown>): AudienceVoteTally[] {
  if (kind === "poll" || kind === "host_picks") {
    const options = Array.isArray(payload.options) ? payload.options : [];
    return options
      .map((item, index) => {
        const label = String(item ?? "").trim();
        if (!label) return null;
        return { key: `opt-${index}`, label, count: 0 };
      })
      .filter((row): row is AudienceVoteTally => Boolean(row));
  }
  if (kind === "hot_take") {
    return [
      { key: "agree", label: "Agree", count: 0 },
      { key: "terrible", label: "Terrible Take", count: 0 },
    ];
  }
  return [];
}

export function applyVoteCounts(
  base: AudienceVoteTally[],
  votes: Array<{ choice_key: string }>,
): { tallies: AudienceVoteTally[]; totalVotes: number } {
  const map = new Map(base.map((row) => [row.key, { ...row }]));
  for (const vote of votes) {
    const row = map.get(vote.choice_key);
    if (row) row.count += 1;
  }
  const tallies = [...map.values()];
  return { tallies, totalVotes: tallies.reduce((sum, row) => sum + row.count, 0) };
}

export function defaultPayloadForKind(kind: AudienceToolKind): Record<string, unknown> {
  switch (kind) {
    case "poll":
      return {
        prompt: "Who wins Saturday?",
        options: ["Home", "Away", "Tie"],
      };
    case "host_picks":
      return {
        prompt: "Who wins Saturday?",
        hostA: { name: "Austin", pick: "", revealed: false },
        hostB: { name: "Hunter", pick: "", revealed: false },
        options: ["Alabama", "Georgia"],
        audienceLabel: "Audience pick",
      };
    case "questions":
      return { prompt: "Submit a question for the hosts" };
    case "hot_take":
      return { statement: "Alabama is overrated" };
    case "message":
      return { text: "Going live in 5", subtitle: "Scan to join the show" };
    case "matchup":
      return {
        teamA: "Alabama",
        teamB: "Georgia",
        kickoff: "Saturday 2:30 PM CT",
        prompt: "Who has the edge?",
        logoA: "",
        logoB: "",
      };
    case "sponsor":
      return {
        name: "Sponsor",
        phone: "",
        blurb: "Presented by our partners",
        imageUrl: "",
      };
    case "countdown":
      return {
        label: "We’ll be right back",
        mode: "break",
        endsAt: null,
        seconds: 120,
      };
    case "picture":
      return {
        imageUrl: "",
        storagePath: "",
        caption: "",
      };
    default:
      return {};
  }
}

export function titleForAudienceTool(kind: AudienceToolKind): string {
  const labels: Record<AudienceToolKind, string> = {
    poll: "Audience poll",
    host_picks: "Austin vs Hunter",
    questions: "Audience questions",
    hot_take: "Hot Take Meter",
    message: "Custom message",
    matchup: "Matchup card",
    sponsor: "Sponsor card",
    countdown: "Countdown",
    picture: "Picture",
  };
  return labels[kind];
}

