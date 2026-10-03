import type { WallJoinNotice } from "@/lib/screens/join-notices";

export const TRIVIA_SESSION_STATUSES = [
  "lobby",
  "question",
  "reveal",
  "podium",
  "final",
  "ended",
] as const;

export type TriviaSessionStatus = (typeof TRIVIA_SESSION_STATUSES)[number];

export type TriviaChoiceIndex = 0 | 1 | 2 | 3;

export type TriviaQuestionRow = {
  id: string;
  pack_id: string;
  venue_id: string;
  prompt: string;
  choice_a: string;
  choice_b: string;
  choice_c: string;
  choice_d: string;
  correct_index: number;
  points: number;
  sort_order: number;
};

export type TriviaSessionQuestion = {
  questionIndex: number;
  questionId: string;
  prompt: string;
  choices: [string, string, string, string];
  correctIndex: TriviaChoiceIndex;
  points: number;
};

export type TriviaLeaderboardEntry = {
  rank: number;
  playerId: string;
  displayName: string;
  score: number;
};

export type TriviaWallQuestion = {
  index: number;
  prompt: string;
  choices: [string, string, string, string];
  correctIndex: TriviaChoiceIndex | null;
};

export type TriviaWallState = {
  sessionId: string;
  joinCode: string;
  joinPath: string;
  status: Exclude<TriviaSessionStatus, "ended">;
  packTitle: string;
  packTheme: string;
  currentQuestionIndex: number;
  questionCount: number;
  phaseEndsAt: string | null;
  playerCount: number;
  question: TriviaWallQuestion | null;
  top3: TriviaLeaderboardEntry[];
  leaderboard: TriviaLeaderboardEntry[];
  recentJoins: WallJoinNotice[];
  serverNow: string;
};

export type TriviaPlayerState = {
  playerId: string;
  displayName: string;
  score: number;
  sessionId: string;
  joinCode: string;
  status: Exclude<TriviaSessionStatus, "ended">;
  currentQuestionIndex: number;
  questionCount: number;
  phaseEndsAt: string | null;
  question: TriviaWallQuestion | null;
  myChoiceIndex: number | null;
  answered: boolean;
  lastAward: number | null;
  rank: number | null;
  serverNow: string;
};

export type TriviaPackSummary = {
  id: string;
  title: string;
  theme: string;
  enabled: boolean;
  questionCount: number;
};

export type TriviaStaffSession = {
  id: string;
  joinCode: string;
  status: TriviaSessionStatus;
  packTitle: string;
  currentQuestionIndex: number;
  questionCount: number;
  phaseEndsAt: string | null;
  playerCount: number;
  startedAt: string;
};
