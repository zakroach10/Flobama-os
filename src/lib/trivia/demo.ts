import type { TriviaWallState } from "@/lib/trivia/types";

export function demoTriviaWall(origin = "https://flobama-os.vercel.app"): TriviaWallState {
  const ends = new Date(Date.now() + 45_000).toISOString();
  return {
    sessionId: "demo-trivia-session",
    joinCode: "SHOAL",
    joinPath: `${origin}/play/SHOAL`,
    status: "lobby",
    packTitle: "Shoals Music History",
    packTheme: "Shoals music history",
    currentQuestionIndex: 0,
    questionCount: 10,
    phaseEndsAt: ends,
    playerCount: 12,
    question: null,
    top3: [],
    leaderboard: [],
    recentJoins: [],
    serverNow: new Date().toISOString(),
  };
}

export function demoTriviaQuestionWall(origin = "https://flobama-os.vercel.app"): TriviaWallState {
  return {
    ...demoTriviaWall(origin),
    status: "question",
    phaseEndsAt: new Date(Date.now() + 18_000).toISOString(),
    question: {
      index: 0,
      prompt: "Who founded FAME Studios in Muscle Shoals?",
      choices: ["Rick Hall", "Sam Phillips", "Berry Gordy", "Ahmet Ertegun"],
      correctIndex: null,
    },
  };
}

export function demoTriviaPodiumWall(origin = "https://flobama-os.vercel.app"): TriviaWallState {
  return {
    ...demoTriviaWall(origin),
    status: "podium",
    phaseEndsAt: new Date(Date.now() + 8_000).toISOString(),
    question: {
      index: 0,
      prompt: "Who founded FAME Studios in Muscle Shoals?",
      choices: ["Rick Hall", "Sam Phillips", "Berry Gordy", "Ahmet Ertegun"],
      correctIndex: 0,
    },
    top3: [
      { rank: 1, playerId: "p1", displayName: "Swamper", score: 2400 },
      { rank: 2, playerId: "p2", displayName: "FameFan", score: 2100 },
      { rank: 3, playerId: "p3", displayName: "RiverCity", score: 1800 },
    ],
  };
}
