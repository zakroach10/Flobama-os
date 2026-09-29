export function scoreAnswer(input: {
  correct: boolean;
  basePoints: number;
  responseMs: number;
  questionMs: number;
}) {
  if (!input.correct) return 0;
  const windowMs = Math.max(1, input.questionMs);
  const clamped = Math.min(Math.max(0, input.responseMs), windowMs);
  const speedFactor = 1 - (clamped / windowMs) * 0.5;
  return Math.max(100, Math.round(input.basePoints * speedFactor));
}

export function buildLeaderboard(
  players: Array<{ id: string; display_name: string; score: number }>,
  limit?: number,
) {
  const sorted = [...players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.display_name.localeCompare(b.display_name);
  });
  const sliced = typeof limit === "number" ? sorted.slice(0, limit) : sorted;
  return sliced.map((player, index) => ({
    rank: index + 1,
    playerId: player.id,
    displayName: player.display_name,
    score: player.score,
  }));
}

export function playerRank(
  players: Array<{ id: string; display_name: string; score: number }>,
  playerId: string,
) {
  const board = buildLeaderboard(players);
  return board.find((entry) => entry.playerId === playerId)?.rank ?? null;
}
