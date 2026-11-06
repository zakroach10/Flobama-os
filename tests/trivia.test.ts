import { describe, expect, it } from "vitest";
import { parseTriviaCsv, TRIVIA_CSV_TEMPLATE } from "@/lib/trivia/csv";
import {
  DEFAULT_TRIVIA_BRAND,
  triviaBrandCssVars,
  triviaBrandFromPackRow,
} from "@/lib/trivia/brand";
import {
  buildWallState,
  createJoinCode,
  nextPhase,
  phaseDurationSeconds,
  shouldAdvancePhase,
  wallQuestionFromRow,
} from "@/lib/trivia/engine";
import { buildLeaderboard, scoreAnswer } from "@/lib/trivia/scoring";

describe("trivia scoring", () => {
  it("awards speed-weighted points for correct answers", () => {
    expect(scoreAnswer({ correct: false, basePoints: 1000, responseMs: 100, questionMs: 20000 })).toBe(0);
    const fast = scoreAnswer({ correct: true, basePoints: 1000, responseMs: 0, questionMs: 20000 });
    const slow = scoreAnswer({ correct: true, basePoints: 1000, responseMs: 20000, questionMs: 20000 });
    expect(fast).toBe(1000);
    expect(slow).toBe(500);
    expect(fast).toBeGreaterThan(slow);
  });

  it("ranks players by score then name", () => {
    const board = buildLeaderboard([
      { id: "1", display_name: "Zed", score: 100 },
      { id: "2", display_name: "Ann", score: 300 },
      { id: "3", display_name: "Bob", score: 300 },
    ]);
    expect(board.map((entry) => entry.displayName)).toEqual(["Ann", "Bob", "Zed"]);
    expect(board[0]?.rank).toBe(1);
  });
});

describe("trivia engine", () => {
  it("advances lobby through final automatically", () => {
    expect(nextPhase({ status: "lobby", currentQuestionIndex: 0, questionCount: 2 })).toEqual({
      status: "question",
      currentQuestionIndex: 0,
    });
    expect(nextPhase({ status: "question", currentQuestionIndex: 0, questionCount: 2 })).toEqual({
      status: "reveal",
      currentQuestionIndex: 0,
    });
    expect(nextPhase({ status: "reveal", currentQuestionIndex: 0, questionCount: 2 })).toEqual({
      status: "podium",
      currentQuestionIndex: 0,
    });
    expect(nextPhase({ status: "podium", currentQuestionIndex: 0, questionCount: 2 })).toEqual({
      status: "question",
      currentQuestionIndex: 1,
    });
    expect(nextPhase({ status: "podium", currentQuestionIndex: 1, questionCount: 2 })).toEqual({
      status: "final",
      currentQuestionIndex: 1,
    });
    expect(nextPhase({ status: "final", currentQuestionIndex: 1, questionCount: 2 })).toEqual({
      status: "ended",
      currentQuestionIndex: 1,
    });
  });

  it("hides correct answers until reveal", () => {
    const row = {
      question_index: 0,
      prompt: "Who?",
      choice_a: "A",
      choice_b: "B",
      choice_c: "C",
      choice_d: "D",
      correct_index: 2,
    };
    expect(wallQuestionFromRow(row, "question")?.correctIndex).toBeNull();
    expect(wallQuestionFromRow(row, "reveal")?.correctIndex).toBe(2);
  });

  it("uses configured phase durations", () => {
    expect(
      phaseDurationSeconds({
        status: "lobby",
        lobby_seconds: 45,
        question_seconds: 20,
        reveal_seconds: 6,
        podium_seconds: 8,
        final_seconds: 90,
      }),
    ).toBe(45);
    expect(shouldAdvancePhase(new Date(Date.now() - 1000).toISOString())).toBe(true);
    expect(shouldAdvancePhase(new Date(Date.now() + 5000).toISOString())).toBe(false);
  });

  it("creates short join codes", () => {
    expect(createJoinCode(() => 0)).toHaveLength(5);
  });
});

describe("trivia csv import", () => {
  it("parses spreadsheet rows with A-D answers", () => {
    const csv = `question,a,b,c,d,correct,points
Who founded FAME?,Rick Hall,Sam Phillips,Berry Gordy,Ahmet Ertegun,A,1000
Studio on?,Jackson Highway,Beale Street,Music Row,Bourbon Street,B,800
`;
    const parsed = parseTriviaCsv(csv);
    expect(parsed.errors).toEqual([]);
    expect(parsed.questions).toHaveLength(2);
    expect(parsed.questions[0]?.correctIndex).toBe(0);
    expect(parsed.questions[1]?.correctIndex).toBe(1);
    expect(parsed.questions[1]?.points).toBe(800);
  });

  it("reports row errors without accepting bad correct values", () => {
    const parsed = parseTriviaCsv(`question,a,b,c,d,correct
Q?,A1,B1,C1,D1,E
`);
    expect(parsed.questions).toHaveLength(0);
    expect(parsed.errors[0]).toMatch(/correct/i);
  });

  it("ships a template with mixed correct letters, not all A", () => {
    const parsed = parseTriviaCsv(TRIVIA_CSV_TEMPLATE);
    expect(parsed.errors).toEqual([]);
    expect(parsed.questions.length).toBeGreaterThan(1);
    const indexes = new Set(parsed.questions.map((question) => question.correctIndex));
    expect(indexes.has(0)).toBe(true);
    expect(indexes.size).toBeGreaterThan(1);
  });
});

describe("trivia pack brand", () => {
  it("falls back to FloBama defaults and exposes CSS vars", () => {
    expect(triviaBrandFromPackRow(null)).toEqual(DEFAULT_TRIVIA_BRAND);
    const branded = triviaBrandFromPackRow({
      brand_background: "#112233",
      brand_text: "#ffffff",
      brand_accent: "#ff6600",
      brand_muted: "#aabbcc",
      brand_muted_strong: "#8899aa",
      brand_logo_url: "https://example.com/logo.png",
    });
    expect(branded.accent).toBe("#ff6600");
    expect(branded.logoUrl).toBe("https://example.com/logo.png");
    expect(triviaBrandCssVars(branded)["--trivia-accent"]).toBe("#ff6600");
  });

  it("includes brand on wall state payloads", () => {
    const wall = buildWallState({
      sessionId: "s",
      joinCode: "ABCD",
      joinPath: "/play/ABCD",
      status: "lobby",
      packTitle: "Festival",
      packTheme: "Songwriters",
      brand: { ...DEFAULT_TRIVIA_BRAND, accent: "#004466" },
      currentQuestionIndex: 0,
      questionCount: 5,
      phaseEndsAt: null,
      playerCount: 0,
      question: null,
      top3: [],
      leaderboard: [],
    });
    expect(wall.brand.accent).toBe("#004466");
  });
});
