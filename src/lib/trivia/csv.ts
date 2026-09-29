import { parseCsvRecords } from "@/lib/legacy/parser";
import type { TriviaChoiceIndex } from "@/lib/trivia/types";

export type ParsedTriviaCsvQuestion = {
  prompt: string;
  choiceA: string;
  choiceB: string;
  choiceC: string;
  choiceD: string;
  correctIndex: TriviaChoiceIndex;
  points: number;
};

export type TriviaCsvParseResult = {
  questions: ParsedTriviaCsvQuestion[];
  errors: string[];
};

const HEADER_MAP: Record<string, string> = {
  question: "prompt",
  prompt: "prompt",
  a: "choiceA",
  option_a: "choiceA",
  "option a": "choiceA",
  choice_a: "choiceA",
  "choice a": "choiceA",
  b: "choiceB",
  option_b: "choiceB",
  "option b": "choiceB",
  choice_b: "choiceB",
  "choice b": "choiceB",
  c: "choiceC",
  option_c: "choiceC",
  "option c": "choiceC",
  choice_c: "choiceC",
  "choice c": "choiceC",
  d: "choiceD",
  option_d: "choiceD",
  "option d": "choiceD",
  choice_d: "choiceD",
  "choice d": "choiceD",
  correct: "correct",
  answer: "correct",
  points: "points",
  point: "points",
};

function normalizeHeader(raw: string) {
  return HEADER_MAP[raw.trim().toLowerCase()] ?? raw.trim();
}

function parseCorrect(value: string): TriviaChoiceIndex | null {
  const trimmed = value.trim().toUpperCase();
  if (trimmed === "A" || trimmed === "0") return 0;
  if (trimmed === "B" || trimmed === "1") return 1;
  if (trimmed === "C" || trimmed === "2") return 2;
  if (trimmed === "D" || trimmed === "3") return 3;
  if (trimmed === "4") return 3;
  return null;
}

export function parseTriviaCsv(text: string): TriviaCsvParseResult {
  const rawRows = parseCsvRecords(text);
  if (rawRows.length === 0) {
    return { questions: [], errors: ["Spreadsheet is empty."] };
  }

  const questions: ParsedTriviaCsvQuestion[] = [];
  const errors: string[] = [];

  rawRows.forEach((raw, index) => {
    const row: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
      row[normalizeHeader(key)] = value;
    }

    const prompt = (row.prompt ?? "").trim();
    const choiceA = (row.choiceA ?? "").trim();
    const choiceB = (row.choiceB ?? "").trim();
    const choiceC = (row.choiceC ?? "").trim();
    const choiceD = (row.choiceD ?? "").trim();
    const correctIndex = parseCorrect(row.correct ?? "");
    const pointsRaw = (row.points ?? "1000").trim();
    const points = Number.parseInt(pointsRaw, 10);
    const line = index + 2;

    if (!prompt && !choiceA && !choiceB && !choiceC && !choiceD) return;

    if (!prompt || prompt.length > 500) {
      errors.push(`Row ${line}: question is required (max 500 characters).`);
      return;
    }
    if (!choiceA || !choiceB || !choiceC || !choiceD) {
      errors.push(`Row ${line}: choices A–D are all required.`);
      return;
    }
    if ([choiceA, choiceB, choiceC, choiceD].some((choice) => choice.length > 200)) {
      errors.push(`Row ${line}: each choice must be 200 characters or fewer.`);
      return;
    }
    if (correctIndex == null) {
      errors.push(`Row ${line}: correct must be A, B, C, or D.`);
      return;
    }
    if (!Number.isFinite(points) || points < 100 || points > 10000) {
      errors.push(`Row ${line}: points must be between 100 and 10000.`);
      return;
    }

    questions.push({
      prompt,
      choiceA,
      choiceB,
      choiceC,
      choiceD,
      correctIndex,
      points,
    });
  });

  if (questions.length === 0 && errors.length === 0) {
    errors.push("No question rows found. Use headers: question,a,b,c,d,correct,points");
  }

  return { questions, errors };
}

export const TRIVIA_CSV_TEMPLATE = `question,a,b,c,d,correct,points
Who founded FAME Studios in Muscle Shoals?,Rick Hall,Sam Phillips,Berry Gordy,Ahmet Ertegun,A,1000
Muscle Shoals Sound Studio was started by which house band?,The Swampers,The Funk Brothers,Booker T. & the M.G.'s,The Wrecking Crew,A,1000
`;
