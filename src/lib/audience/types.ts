export const AUDIENCE_TOOL_KINDS = [
  "poll",
  "host_picks",
  "questions",
  "hot_take",
  "message",
  "matchup",
  "pickem_promo",
  "leaderboard",
  "sponsor",
  "countdown",
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

export type AudienceWallState = {
  sessionId: string;
  title: string;
  joinCode: string;
  joinPath: string;
  guestCount: number;
  tool: AudienceWallTool | null;
  lobbyMessage: string;
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
  poll: "Live audience poll",
  host_picks: "Austin vs Hunter picks",
  questions: "Audience questions",
  hot_take: "Hot Take Meter",
  message: "Custom message",
  matchup: "Matchup card",
  pickem_promo: "Pick’em promotion",
  leaderboard: "Leaderboard spotlight",
  sponsor: "Sponsor card",
  countdown: "Countdown / break",
};
