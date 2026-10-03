import type { WallJoinNotice } from "@/lib/screens/join-notices";

export const AUDIENCE_TOOL_KINDS = [
  "poll",
  "host_picks",
  "questions",
  "hot_take",
  "message",
  "matchup",
  "sponsor",
  "countdown",
  "picture",
] as const;

export type AudienceToolKind = (typeof AUDIENCE_TOOL_KINDS)[number];

export type AudienceToolStatus = "ready" | "on_wall" | "archived";
export type AudienceSessionStatus = "live" | "ended";
export type AudienceQuestionStatus = "pending" | "approved" | "on_wall" | "rejected" | "done";

export type AudienceVoteTally = { key: string; label: string; count: number };

export type AudienceToolPayload = Record<string, unknown>;

export type AudienceWallTool = {
  id: string;
  kind: AudienceToolKind;
  title: string;
  payload: AudienceToolPayload;
  votingOpen: boolean;
  resultsRevealed: boolean;
  tallies: AudienceVoteTally[];
  totalVotes: number;
  questionOnWall?: { id: string; displayName: string; body: string } | null;
};

export const AUDIENCE_CORNER_POSITIONS = ["bottom-left", "bottom-right"] as const;

export type AudienceCornerPosition = (typeof AUDIENCE_CORNER_POSITIONS)[number];

export type AudienceCornerSponsor = {
  name: string;
  imageUrl: string | null;
  corner: AudienceCornerPosition;
};

export type AudienceWallState = {
  sessionId: string;
  title: string;
  joinCode: string;
  joinPath: string;
  guestCount: number;
  brandLogoUrl: string | null;
  cornerSponsor: AudienceCornerSponsor | null;
  tool: AudienceWallTool | null;
  lobbyMessage: string;
  recentJoins: WallJoinNotice[];
};

export type AudienceGuestState = {
  sessionId: string;
  joinCode: string;
  displayName: string;
  votingOpen: boolean;
  resultsRevealed: boolean;
  tool: AudienceWallTool | null;
  myVote: string | null;
  canSubmitQuestion: boolean;
};

export const AUDIENCE_TOOL_LABELS: Record<AudienceToolKind, string> = {
  poll: "Audience poll",
  host_picks: "Austin vs Hunter picks",
  questions: "Audience questions",
  hot_take: "Hot Take Meter",
  message: "Custom message",
  matchup: "Matchup card",
  sponsor: "Sponsor card",
  countdown: "Countdown / break",
  picture: "Picture / graphic",
};

export const AUDIENCE_TOOL_HINTS: Record<AudienceToolKind, string> = {
  poll: "Ask a question. Guests vote. Hide results until you reveal them.",
  host_picks: "Show each host’s pick, then the audience choice.",
  questions: "Guests submit questions. You approve one onto the wall.",
  hot_take: "Put a statement up and let the room vote Agree or Terrible Take.",
  message: "Instant announcement on the wall.",
  matchup: "Team names, kickoff, and a discussion prompt.",
  sponsor: "Full sponsor card with a name, phone number, and blurb, or pin a logo in the corner while other content stays up.",
  countdown: "Pre-show timer or “we’ll be right back” break.",
  picture: "Upload a photo or graphic, save it as a preset, put it on the LED wall.",
};
