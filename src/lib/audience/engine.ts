import { randomBytes } from "node:crypto";
import type { AudienceToolKind, AudienceVoteTally } from "@/lib/audience/types";
import { AUDIENCE_TOOL_KINDS } from "@/lib/audience/types";

export function isAudienceToolKind(value: string): value is AudienceToolKind {
  return (AUDIENCE_TOOL_KINDS as readonly string[]).includes(value);
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
    case "pickem_promo":
      return {
        title: "FloBama Pick’em",
        qrUrl: "https://flobama.com",
        deadline: "Lock Sunday 11:00 AM CT",
        prize: "Winner takes the weekly prize",
      };
    case "leaderboard":
      return {
        title: "Pick’em leaders",
        entries: [
          { name: "Player 1", points: 12 },
          { name: "Player 2", points: 10 },
          { name: "Player 3", points: 9 },
        ],
        spotlightIndex: 0,
      };
    case "sponsor":
      return {
        name: "Sponsor",
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
    default:
      return {};
  }
}
