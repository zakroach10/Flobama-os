import type {
  TriviaChoiceIndex,
  TriviaLeaderboardEntry,
  TriviaSessionStatus,
  TriviaWallQuestion,
  TriviaWallState,
} from "@/lib/trivia/types";

export function isActiveTriviaStatus(status: string): status is Exclude<TriviaSessionStatus, "ended"> {
  return status === "lobby" || status === "question" || status === "reveal" || status === "podium" || status === "final";
}

export function phaseDurationSeconds(session: {
  status: TriviaSessionStatus;
  lobby_seconds: number;
  question_seconds: number;
  reveal_seconds: number;
  podium_seconds: number;
  final_seconds: number;
}) {
  switch (session.status) {
    case "lobby":
      return session.lobby_seconds;
    case "question":
      return session.question_seconds;
    case "reveal":
      return session.reveal_seconds;
    case "podium":
      return session.podium_seconds;
    case "final":
      return session.final_seconds;
    default:
      return 0;
  }
}

export function nextPhase(input: {
  status: TriviaSessionStatus;
  currentQuestionIndex: number;
  questionCount: number;
}): { status: TriviaSessionStatus; currentQuestionIndex: number } | null {
  const { status, currentQuestionIndex, questionCount } = input;
  if (status === "lobby") {
    return { status: "question", currentQuestionIndex: 0 };
  }
  if (status === "question") {
    return { status: "reveal", currentQuestionIndex };
  }
  if (status === "reveal") {
    return { status: "podium", currentQuestionIndex };
  }
  if (status === "podium") {
    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex >= questionCount) {
      return { status: "final", currentQuestionIndex };
    }
    return { status: "question", currentQuestionIndex: nextIndex };
  }
  if (status === "final") {
    return { status: "ended", currentQuestionIndex };
  }
  return null;
}

export function phaseEndsAtIso(seconds: number, now: Date = new Date()) {
  return new Date(now.getTime() + seconds * 1000).toISOString();
}

export function shouldAdvancePhase(phaseEndsAt: string | null | undefined, now: Date = new Date()) {
  if (!phaseEndsAt) return false;
  const ends = Date.parse(phaseEndsAt);
  return Number.isFinite(ends) && ends <= now.getTime();
}

export function choicesFromRow(row: {
  choice_a: string;
  choice_b: string;
  choice_c: string;
  choice_d: string;
}): [string, string, string, string] {
  return [row.choice_a, row.choice_b, row.choice_c, row.choice_d];
}

export function wallQuestionFromRow(
  row: {
    question_index: number;
    prompt: string;
    choice_a: string;
    choice_b: string;
    choice_c: string;
    choice_d: string;
    correct_index: number;
  } | null,
  status: TriviaSessionStatus,
): TriviaWallQuestion | null {
  if (!row) return null;
  const showAnswer = status === "reveal" || status === "podium" || status === "final";
  return {
    index: row.question_index,
    prompt: row.prompt,
    choices: choicesFromRow(row),
    correctIndex: showAnswer ? (row.correct_index as TriviaChoiceIndex) : null,
  };
}

export function buildWallState(input: {
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
  serverNow?: string;
}): TriviaWallState {
  return {
    sessionId: input.sessionId,
    joinCode: input.joinCode,
    joinPath: input.joinPath,
    status: input.status,
    packTitle: input.packTitle,
    packTheme: input.packTheme,
    currentQuestionIndex: input.currentQuestionIndex,
    questionCount: input.questionCount,
    phaseEndsAt: input.phaseEndsAt,
    playerCount: input.playerCount,
    question: input.status === "lobby" || input.status === "final" ? null : input.question,
    top3: input.status === "podium" || input.status === "final" ? input.top3 : [],
    leaderboard: input.status === "final" ? input.leaderboard : [],
    serverNow: input.serverNow ?? new Date().toISOString(),
  };
}

export function createJoinCode(random: () => number = Math.random) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i += 1) {
    code += alphabet[Math.floor(random() * alphabet.length)]!;
  }
  return code;
}

export function newPlayerToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

export function normalizeDisplayName(raw: string) {
  return raw.trim().replace(/\s+/g, " ").slice(0, 24);
}

export function isMissingTriviaRelation(message: string | null | undefined) {
  return /trivia_/i.test(message ?? "") && /does not exist|schema cache|could not find/i.test(message ?? "");
}
