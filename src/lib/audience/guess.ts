import type { AudienceGuessBubble, AudienceGuessView, AudienceToolKind } from "@/lib/audience/types";

export const GUESS_PLAYER_SLOTS = 10;
export const GUESS_NAME_MAX = 80;
export const GUESS_LYRIC_MAX = 160;
export const GUESS_PROMPT_MAX = 120;
export const GUESS_SONG_MAX = 120;
export const GUESS_BUBBLE_LIMIT = 10;

const PLAYER_ID = /^[A-Za-z0-9_-]{1,40}$/;
const ROUND_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type GuessPlayer = {
  id: string;
  name: string;
  photoUrl: string;
  storagePath: string;
};

export type GuessDecision =
  | { status: "not_ready" }
  | { status: "closed" }
  | { status: "accepted"; answer: string; correct: boolean; won: boolean };

export type StaffGuessRound = {
  kind: "guess_player" | "guess_lyric";
  prompt: string;
  songTitle: string;
  expected: string;
  playerIndex: number;
  playerCount: number;
  photoUrl: string | null;
  status: AudienceGuessView["status"];
  winner: AudienceGuessView["winner"];
  recent: AudienceGuessBubble[];
};

/**
 * Trim leading and trailing whitespace only.
 * The characters that remain must match exactly: capitalization, punctuation,
 * and internal spaces all count. Guess the Lyric uses this same rule.
 */
export function trimGuessAnswer(value: string) {
  return value.trim();
}

export function guessAnswersMatch(expected: string, submitted: string) {
  const left = trimGuessAnswer(expected);
  const right = trimGuessAnswer(submitted);
  if (!left || !right) return false;
  return left === right;
}

export function decideGuess(input: {
  expected: string | null | undefined;
  submitted: string;
  hasWinner: boolean;
}): GuessDecision {
  if (input.hasWinner) return { status: "closed" };
  const expected = trimGuessAnswer(input.expected ?? "");
  const answer = trimGuessAnswer(input.submitted);
  if (!expected || !answer) return { status: "not_ready" };
  const correct = answer === expected;
  return { status: "accepted", answer, correct, won: correct };
}

export function emptyGuessPlayers(): GuessPlayer[] {
  return Array.from({ length: GUESS_PLAYER_SLOTS }, (_, index) => ({
    id: `player-${index + 1}`,
    name: "",
    photoUrl: "",
    storagePath: "",
  }));
}

export function defaultGuessPlayerPayload(): Record<string, unknown> {
  const players = emptyGuessPlayers();
  return {
    prompt: "Who is this?",
    players,
    activePlayerId: players[0]?.id ?? "player-1",
  };
}

export function defaultGuessLyricPayload(): Record<string, unknown> {
  return {
    prompt: "What lyric is this?",
    songTitle: "",
    answer: "",
    roundId: "",
  };
}

export function newGuessRoundId() {
  return crypto.randomUUID();
}

export function guessPlayersForEditor(payload: Record<string, unknown>) {
  return padPlayers(parseGuessPlayers(payload));
}

export function parseGuessPlayers(payload: Record<string, unknown>): GuessPlayer[] {
  const raw = Array.isArray(payload.players) ? payload.players : [];
  const parsed: GuessPlayer[] = [];
  for (const item of raw.slice(0, GUESS_PLAYER_SLOTS)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = String(row.id ?? "").trim();
    if (!PLAYER_ID.test(id)) continue;
    parsed.push({
      id,
      name: trimGuessAnswer(String(row.name ?? "")).slice(0, GUESS_NAME_MAX),
      photoUrl: String(row.photoUrl ?? "").trim().slice(0, 800),
      storagePath: String(row.storagePath ?? "").trim().slice(0, 400),
    });
  }
  return parsed;
}

export function moveGuessPlayer(players: GuessPlayer[], index: number, direction: -1 | 1) {
  const next = index + direction;
  if (index < 0 || next < 0 || index >= players.length || next >= players.length) return players;
  const copy = players.slice();
  const [row] = copy.splice(index, 1);
  if (!row) return players;
  copy.splice(next, 0, row);
  return copy;
}

function padPlayers(players: GuessPlayer[]) {
  const seen = new Set(players.map((player) => player.id));
  const padded = players.slice(0, GUESS_PLAYER_SLOTS);
  let n = 1;
  while (padded.length < GUESS_PLAYER_SLOTS) {
    let id = `player-${n}`;
    while (seen.has(id)) {
      n += 1;
      id = `player-${n}`;
    }
    seen.add(id);
    padded.push({ id, name: "", photoUrl: "", storagePath: "" });
    n += 1;
  }
  return padded;
}

function photoError(player: GuessPlayer, venueId: string) {
  const hasPhoto = Boolean(player.photoUrl || player.storagePath);
  if (!hasPhoto) return null;
  if (!player.photoUrl || !/^https?:\/\//i.test(player.photoUrl)) {
    return `Photo for ${player.name || "a player"} must be an uploaded image.`;
  }
  if (!player.storagePath.startsWith(`${venueId}/audience/`)) {
    return "Player photo path is not valid for this venue.";
  }
  return null;
}

export function sanitizeGuessPlayerPayload(
  payload: Record<string, unknown>,
  venueId: string,
  mode: "draft" | "live",
): { ok: true; payload: Record<string, unknown> } | { ok: false; message: string } {
  const prompt = trimGuessAnswer(String(payload.prompt ?? "Who is this?")).slice(0, GUESS_PROMPT_MAX) || "Who is this?";
  const players = padPlayers(parseGuessPlayers(payload));
  for (const player of players) {
    const invalid = photoError(player, venueId);
    if (invalid) return { ok: false, message: invalid };
    if (mode === "live") {
      if (!player.name) {
        return { ok: false, message: "Every player needs a name before the game goes on the wall." };
      }
      if (!player.photoUrl) {
        return { ok: false, message: `${player.name} needs a photo.` };
      }
    }
  }
  const requested = String(payload.activePlayerId ?? "").trim();
  const activePlayerId = players.some((player) => player.id === requested)
    ? requested
    : (players[0]?.id ?? "player-1");
  return {
    ok: true,
    payload: { prompt, players, activePlayerId },
  };
}

export function sanitizeGuessLyricPayload(
  payload: Record<string, unknown>,
  mode: "draft" | "live",
): { ok: true; payload: Record<string, unknown> } | { ok: false; message: string } {
  const prompt =
    trimGuessAnswer(String(payload.prompt ?? "What lyric is this?")).slice(0, GUESS_PROMPT_MAX) ||
    "What lyric is this?";
  const songTitle = trimGuessAnswer(String(payload.songTitle ?? "")).slice(0, GUESS_SONG_MAX);
  const answer = trimGuessAnswer(String(payload.answer ?? "")).slice(0, GUESS_LYRIC_MAX);
  const roundRaw = String(payload.roundId ?? "").trim();
  const roundId = ROUND_ID.test(roundRaw) ? roundRaw : "";
  if (mode === "live" && !answer) {
    return { ok: false, message: "Enter the correct lyric before starting the round." };
  }
  return { ok: true, payload: { prompt, songTitle, answer, roundId } };
}

export function prepareCreatedGuessPayload(
  kind: AudienceToolKind,
  payload: Record<string, unknown>,
  venueId: string,
): { ok: true; payload: Record<string, unknown> } | { ok: false; message: string } {
  if (kind === "guess_player") {
    const sanitized = sanitizeGuessPlayerPayload(payload, venueId, "draft");
    if (!sanitized.ok) return sanitized;
    const players = parseGuessPlayers(sanitized.payload);
    const first = players.find((player) => player.name && player.photoUrl) ?? players[0];
    return {
      ok: true,
      payload: { ...sanitized.payload, activePlayerId: first?.id ?? "player-1" },
    };
  }
  if (kind === "guess_lyric") {
    const sanitized = sanitizeGuessLyricPayload(payload, "draft");
    if (!sanitized.ok) return sanitized;
    return { ok: true, payload: { ...sanitized.payload, roundId: newGuessRoundId() } };
  }
  return { ok: true, payload };
}

export function assertGuessReadyForWall(
  kind: AudienceToolKind,
  payload: Record<string, unknown>,
  venueId: string,
): { ok: true; payload: Record<string, unknown> } | { ok: false; message: string } {
  if (kind === "guess_player") return sanitizeGuessPlayerPayload(payload, venueId, "live");
  if (kind === "guess_lyric") {
    const sanitized = sanitizeGuessLyricPayload(payload, "live");
    if (!sanitized.ok) return sanitized;
    if (!String(sanitized.payload.roundId ?? "")) {
      return { ok: false, message: "Start the lyric round before putting it on the wall." };
    }
    return sanitized;
  }
  return { ok: true, payload };
}

export function guessRoundKey(kind: "guess_player" | "guess_lyric", payload: Record<string, unknown>) {
  if (kind === "guess_player") {
    const id = String(payload.activePlayerId ?? "").trim();
    return id || null;
  }
  const id = String(payload.roundId ?? "").trim();
  return id || null;
}

export function expectedGuessAnswer(kind: "guess_player" | "guess_lyric", payload: Record<string, unknown>) {
  if (kind === "guess_player") {
    const players = parseGuessPlayers(payload);
    const id = String(payload.activePlayerId ?? "");
    return players.find((player) => player.id === id)?.name || null;
  }
  return trimGuessAnswer(String(payload.answer ?? "")) || null;
}

export function redactGuessPayload(
  kind: "guess_player" | "guess_lyric",
  payload: Record<string, unknown>,
): Record<string, unknown> {
  if (kind === "guess_player") {
    const players = parseGuessPlayers(payload);
    const activeId = String(payload.activePlayerId ?? "");
    const index = players.findIndex((player) => player.id === activeId);
    const active = index >= 0 ? players[index] : null;
    return {
      prompt: trimGuessAnswer(String(payload.prompt ?? "Who is this?")) || "Who is this?",
      playerCount: players.length,
      playerIndex: index >= 0 ? index + 1 : 0,
      photoUrl: active?.photoUrl ?? "",
    };
  }
  return {
    prompt: trimGuessAnswer(String(payload.prompt ?? "What lyric is this?")) || "What lyric is this?",
  };
}

export function buildGuessView(input: {
  kind: "guess_player" | "guess_lyric";
  payload: Record<string, unknown>;
  submissions: AudienceGuessBubble[];
}): AudienceGuessView {
  const redacted = redactGuessPayload(input.kind, input.payload);
  const winnerRow = input.submissions.find((row) => row.won) ?? null;
  const expected = expectedGuessAnswer(input.kind, input.payload);
  const status: AudienceGuessView["status"] = winnerRow ? "won" : expected ? "playing" : "waiting";
  return {
    roundKey: guessRoundKey(input.kind, input.payload) ?? "",
    prompt: String(redacted.prompt ?? ""),
    photoUrl: input.kind === "guess_player" ? String(redacted.photoUrl ?? "") || null : null,
    playerIndex: Number(redacted.playerIndex ?? 0),
    playerCount: Number(redacted.playerCount ?? 0),
    status,
    winner: winnerRow ? { displayName: winnerRow.displayName, answer: winnerRow.answer } : null,
    bubbles: input.submissions.filter((row) => !row.won),
  };
}

export function staffGuessRound(input: {
  kind: "guess_player" | "guess_lyric";
  payload: Record<string, unknown>;
  submissions: AudienceGuessBubble[];
}): StaffGuessRound {
  const view = buildGuessView(input);
  return {
    kind: input.kind,
    prompt: view.prompt,
    songTitle: input.kind === "guess_lyric" ? trimGuessAnswer(String(input.payload.songTitle ?? "")) : "",
    expected: expectedGuessAnswer(input.kind, input.payload) ?? "",
    playerIndex: view.playerIndex,
    playerCount: view.playerCount,
    photoUrl: view.photoUrl,
    status: view.status,
    winner: view.winner,
    recent: input.submissions.slice(0, 12),
  };
}

export function isGuessToolKind(kind: string): kind is "guess_player" | "guess_lyric" {
  return kind === "guess_player" || kind === "guess_lyric";
}
