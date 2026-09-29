import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildWallState,
  createJoinCode,
  isActiveTriviaStatus,
  nextPhase,
  phaseDurationSeconds,
  phaseEndsAtIso,
  shouldAdvancePhase,
  wallQuestionFromRow,
} from "@/lib/trivia/engine";
import { buildLeaderboard, playerRank, scoreAnswer } from "@/lib/trivia/scoring";
import type { TriviaPlayerState, TriviaWallState } from "@/lib/trivia/types";

type AnyClient = SupabaseClient;

type SessionRow = {
  id: string;
  venue_id: string;
  pack_id: string;
  join_code: string;
  status: string;
  current_question_index: number;
  question_count: number;
  phase_ends_at: string | null;
  lobby_seconds: number;
  question_seconds: number;
  reveal_seconds: number;
  podium_seconds: number;
  final_seconds: number;
  started_at: string;
};

type QuestionSnap = {
  question_index: number;
  prompt: string;
  choice_a: string;
  choice_b: string;
  choice_c: string;
  choice_d: string;
  correct_index: number;
  points: number;
};

async function loadActiveSession(client: AnyClient, venueId: string) {
  const { data, error } = await client
    .from("trivia_sessions" as never)
    .select(
      "id, venue_id, pack_id, join_code, status, current_question_index, question_count, phase_ends_at, lobby_seconds, question_seconds, reveal_seconds, podium_seconds, final_seconds, started_at",
    )
    .eq("venue_id", venueId)
    .neq("status", "ended")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { session: null as SessionRow | null, error: error.message };
  return { session: (data as SessionRow | null) ?? null, error: null as string | null };
}

async function loadPackMeta(client: AnyClient, packId: string) {
  const { data, error } = await client
    .from("trivia_packs" as never)
    .select("title, theme")
    .eq("id", packId)
    .maybeSingle();
  if (error) return { title: "Trivia", theme: "Shoals music history", error: error.message };
  const row = data as { title?: string; theme?: string } | null;
  return {
    title: row?.title ?? "Trivia",
    theme: row?.theme ?? "Shoals music history",
    error: null as string | null,
  };
}

async function loadSessionQuestion(client: AnyClient, sessionId: string, questionIndex: number) {
  const { data, error } = await client
    .from("trivia_session_questions" as never)
    .select("question_index, prompt, choice_a, choice_b, choice_c, choice_d, correct_index, points")
    .eq("session_id", sessionId)
    .eq("question_index", questionIndex)
    .maybeSingle();
  if (error) return { question: null as QuestionSnap | null, error: error.message };
  return { question: (data as QuestionSnap | null) ?? null, error: null as string | null };
}

async function loadPlayers(client: AnyClient, sessionId: string) {
  const { data, error } = await client
    .from("trivia_players" as never)
    .select("id, display_name, score")
    .eq("session_id", sessionId);
  if (error) return { players: [] as Array<{ id: string; display_name: string; score: number }>, error: error.message };
  return {
    players: (data as Array<{ id: string; display_name: string; score: number }> | null) ?? [],
    error: null as string | null,
  };
}

export async function advanceTriviaSession(client: AnyClient, session: SessionRow, now: Date = new Date()) {
  if (!isActiveTriviaStatus(session.status)) return { session, advanced: false, error: null as string | null };
  if (!shouldAdvancePhase(session.phase_ends_at, now)) {
    return { session, advanced: false, error: null as string | null };
  }

  let current = session;
  let guard = 0;
  while (shouldAdvancePhase(current.phase_ends_at, now) && isActiveTriviaStatus(current.status) && guard < 8) {
    guard += 1;
    const next = nextPhase({
      status: current.status as import("@/lib/trivia/types").TriviaSessionStatus,
      currentQuestionIndex: current.current_question_index,
      questionCount: current.question_count,
    });
    if (!next) break;

    if (next.status === "ended") {
      const { data, error } = await client
        .from("trivia_sessions" as never)
        .update({
          status: "ended",
          ended_at: now.toISOString(),
          phase_ends_at: null,
        } as never)
        .eq("id", current.id)
        .select(
          "id, venue_id, pack_id, join_code, status, current_question_index, question_count, phase_ends_at, lobby_seconds, question_seconds, reveal_seconds, podium_seconds, final_seconds, started_at",
        )
        .single();
      if (error) return { session: current, advanced: true, error: error.message };
      current = data as SessionRow;
      break;
    }

    const duration = phaseDurationSeconds({
      status: next.status,
      lobby_seconds: current.lobby_seconds,
      question_seconds: current.question_seconds,
      reveal_seconds: current.reveal_seconds,
      podium_seconds: current.podium_seconds,
      final_seconds: current.final_seconds,
    });

    const { data, error } = await client
      .from("trivia_sessions" as never)
      .update({
        status: next.status,
        current_question_index: next.currentQuestionIndex,
        phase_ends_at: phaseEndsAtIso(duration, now),
      } as never)
      .eq("id", current.id)
      .select(
        "id, venue_id, pack_id, join_code, status, current_question_index, question_count, phase_ends_at, lobby_seconds, question_seconds, reveal_seconds, podium_seconds, final_seconds, started_at",
      )
      .single();
    if (error) return { session: current, advanced: true, error: error.message };
    current = data as SessionRow;
  }

  return { session: current, advanced: true, error: null as string | null };
}

export async function getAdvancedActiveSession(client: AnyClient, venueId: string, now: Date = new Date()) {
  const loaded = await loadActiveSession(client, venueId);
  if (loaded.error || !loaded.session) return loaded;
  const advanced = await advanceTriviaSession(client, loaded.session, now);
  if (advanced.error) return { session: advanced.session, error: advanced.error };
  if (advanced.session.status === "ended") return { session: null, error: null };
  return { session: advanced.session, error: null };
}

export async function buildPublicWallState(
  client: AnyClient,
  venueId: string,
  joinPathForCode: (code: string) => string,
  now: Date = new Date(),
): Promise<{ wall: TriviaWallState | null; error: string | null }> {
  const { session, error } = await getAdvancedActiveSession(client, venueId, now);
  if (error) return { wall: null, error };
  if (!session || !isActiveTriviaStatus(session.status)) return { wall: null, error: null };

  const [pack, playersRes, questionRes] = await Promise.all([
    loadPackMeta(client, session.pack_id),
    loadPlayers(client, session.id),
    session.status === "lobby" || session.status === "final"
      ? Promise.resolve({ question: null as QuestionSnap | null, error: null as string | null })
      : loadSessionQuestion(client, session.id, session.current_question_index),
  ]);

  if (playersRes.error) return { wall: null, error: playersRes.error };
  if (questionRes.error) return { wall: null, error: questionRes.error };

  const leaderboard = buildLeaderboard(playersRes.players);
  const top3 = buildLeaderboard(playersRes.players, 3);
  const question = wallQuestionFromRow(questionRes.question, session.status);

  return {
    wall: buildWallState({
      sessionId: session.id,
      joinCode: session.join_code,
      joinPath: joinPathForCode(session.join_code),
      status: session.status,
      packTitle: pack.title,
      packTheme: pack.theme,
      currentQuestionIndex: session.current_question_index,
      questionCount: session.question_count,
      phaseEndsAt: session.phase_ends_at,
      playerCount: playersRes.players.length,
      question,
      top3,
      leaderboard,
      serverNow: now.toISOString(),
    }),
    error: null,
  };
}

export async function startTriviaSession(
  client: AnyClient,
  input: {
    venueId: string;
    packId: string;
    questionCount?: number;
    startedBy: string | null;
    lobbySeconds?: number;
    questionSeconds?: number;
  },
) {
  const existing = await loadActiveSession(client, input.venueId);
  if (existing.error) return { ok: false as const, message: existing.error };
  if (existing.session) return { ok: false as const, message: "Trivia is already running. End it before starting another." };

  const { data: questions, error: qError } = await client
    .from("trivia_questions" as never)
    .select("id, prompt, choice_a, choice_b, choice_c, choice_d, correct_index, points, sort_order")
    .eq("pack_id", input.packId)
    .eq("venue_id", input.venueId)
    .order("sort_order", { ascending: true });
  if (qError) return { ok: false as const, message: qError.message };
  const list =
    (questions as Array<{
      id: string;
      prompt: string;
      choice_a: string;
      choice_b: string;
      choice_c: string;
      choice_d: string;
      correct_index: number;
      points: number;
    }> | null) ?? [];
  if (list.length === 0) return { ok: false as const, message: "That pack has no questions yet. Upload a spreadsheet first." };

  const count = Math.min(input.questionCount ?? list.length, list.length);
  const selected = list.slice(0, count);
  const lobbySeconds = input.lobbySeconds ?? 60;
  const questionSeconds = input.questionSeconds ?? 20;

  let joinCode = createJoinCode();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data: clash } = await client
      .from("trivia_sessions" as never)
      .select("id")
      .eq("join_code", joinCode)
      .maybeSingle();
    if (!clash) break;
    joinCode = createJoinCode();
  }

  const now = new Date();
  const { data: session, error: sError } = await client
    .from("trivia_sessions" as never)
    .insert({
      venue_id: input.venueId,
      pack_id: input.packId,
      join_code: joinCode,
      status: "lobby",
      current_question_index: 0,
      question_count: selected.length,
      phase_ends_at: phaseEndsAtIso(lobbySeconds, now),
      lobby_seconds: lobbySeconds,
      question_seconds: questionSeconds,
      started_by: input.startedBy,
    } as never)
    .select("id, join_code")
    .single();
  if (sError) return { ok: false as const, message: sError.message };

  const sessionId = (session as { id: string; join_code: string }).id;
  const snaps = selected.map((question, index) => ({
    session_id: sessionId,
    question_index: index,
    question_id: question.id,
    prompt: question.prompt,
    choice_a: question.choice_a,
    choice_b: question.choice_b,
    choice_c: question.choice_c,
    choice_d: question.choice_d,
    correct_index: question.correct_index,
    points: question.points,
  }));

  const { error: snapError } = await client.from("trivia_session_questions" as never).insert(snaps as never);
  if (snapError) {
    await client.from("trivia_sessions" as never).delete().eq("id", sessionId);
    return { ok: false as const, message: snapError.message };
  }

  return {
    ok: true as const,
    message: "Trivia started. Scan the QR on the LED wall to join.",
    sessionId,
    joinCode: (session as { join_code: string }).join_code,
  };
}

export async function endTriviaSession(client: AnyClient, venueId: string) {
  const { session, error } = await loadActiveSession(client, venueId);
  if (error) return { ok: false as const, message: error };
  if (!session) return { ok: false as const, message: "No trivia is running." };
  const { error: updateError } = await client
    .from("trivia_sessions" as never)
    .update({
      status: "ended",
      ended_at: new Date().toISOString(),
      phase_ends_at: null,
    } as never)
    .eq("id", session.id);
  if (updateError) return { ok: false as const, message: updateError.message };
  return { ok: true as const, message: "Trivia ended." };
}

export async function joinTriviaSession(
  client: AnyClient,
  input: { joinCode: string; displayName: string; playerToken: string },
) {
  const code = input.joinCode.trim().toUpperCase();
  const { data: session, error } = await client
    .from("trivia_sessions" as never)
    .select(
      "id, venue_id, pack_id, join_code, status, current_question_index, question_count, phase_ends_at, lobby_seconds, question_seconds, reveal_seconds, podium_seconds, final_seconds, started_at",
    )
    .eq("join_code", code)
    .neq("status", "ended")
    .maybeSingle();
  if (error) return { ok: false as const, message: error.message };
  if (!session) return { ok: false as const, message: "That join code is not active." };

  let current = session as SessionRow;
  const advanced = await advanceTriviaSession(client, current);
  if (advanced.error) return { ok: false as const, message: advanced.error };
  current = advanced.session;
  if (current.status === "ended") return { ok: false as const, message: "Trivia already ended." };
  if (current.status !== "lobby" && current.status !== "question") {
    // allow late join during early rounds
  }

  const { data: existing } = await client
    .from("trivia_players" as never)
    .select("id, display_name, score, player_token")
    .eq("player_token", input.playerToken)
    .eq("session_id", current.id)
    .maybeSingle();

  if (existing) {
    const row = existing as { id: string; display_name: string; score: number };
    return {
      ok: true as const,
      message: "Welcome back.",
      playerId: row.id,
      displayName: row.display_name,
      score: row.score,
      sessionId: current.id,
      joinCode: current.join_code,
    };
  }

  const { data: created, error: createError } = await client
    .from("trivia_players" as never)
    .insert({
      session_id: current.id,
      venue_id: current.venue_id,
      display_name: input.displayName,
      player_token: input.playerToken,
    } as never)
    .select("id, display_name, score")
    .single();
  if (createError) return { ok: false as const, message: createError.message };
  const row = created as { id: string; display_name: string; score: number };
  return {
    ok: true as const,
    message: "Joined trivia.",
    playerId: row.id,
    displayName: row.display_name,
    score: row.score,
    sessionId: current.id,
    joinCode: current.join_code,
  };
}

export async function submitTriviaAnswer(
  client: AnyClient,
  input: { playerToken: string; choiceIndex: number },
) {
  const { data: player, error: playerError } = await client
    .from("trivia_players" as never)
    .select("id, session_id, display_name, score, player_token")
    .eq("player_token", input.playerToken)
    .maybeSingle();
  if (playerError) return { ok: false as const, message: playerError.message };
  if (!player) return { ok: false as const, message: "Join trivia first." };
  const playerRow = player as { id: string; session_id: string; display_name: string; score: number };

  const { data: session, error: sessionError } = await client
    .from("trivia_sessions" as never)
    .select(
      "id, venue_id, pack_id, join_code, status, current_question_index, question_count, phase_ends_at, lobby_seconds, question_seconds, reveal_seconds, podium_seconds, final_seconds, started_at",
    )
    .eq("id", playerRow.session_id)
    .maybeSingle();
  if (sessionError) return { ok: false as const, message: sessionError.message };
  if (!session) return { ok: false as const, message: "Session not found." };

  let current = session as SessionRow;
  const advanced = await advanceTriviaSession(client, current);
  if (advanced.error) return { ok: false as const, message: advanced.error };
  current = advanced.session;
  if (current.status !== "question") return { ok: false as const, message: "Answering is closed for this round." };

  const { data: prior } = await client
    .from("trivia_answers" as never)
    .select("id")
    .eq("session_id", current.id)
    .eq("player_id", playerRow.id)
    .eq("question_index", current.current_question_index)
    .maybeSingle();
  if (prior) return { ok: false as const, message: "You already locked in an answer." };

  const qRes = await loadSessionQuestion(client, current.id, current.current_question_index);
  if (qRes.error || !qRes.question) return { ok: false as const, message: qRes.error ?? "Question missing." };

  const phaseStartMs =
    current.phase_ends_at != null
      ? Date.parse(current.phase_ends_at) - current.question_seconds * 1000
      : Date.now();
  const responseMs = Math.max(0, Date.now() - (Number.isFinite(phaseStartMs) ? phaseStartMs : Date.now()));
  const correct = input.choiceIndex === qRes.question.correct_index;
  const points = scoreAnswer({
    correct,
    basePoints: qRes.question.points,
    responseMs,
    questionMs: current.question_seconds * 1000,
  });

  const { error: answerError } = await client.from("trivia_answers" as never).insert({
    session_id: current.id,
    player_id: playerRow.id,
    question_index: current.current_question_index,
    choice_index: input.choiceIndex,
    correct,
    points_awarded: points,
    response_ms: responseMs,
  } as never);
  if (answerError) return { ok: false as const, message: answerError.message };

  if (points > 0) {
    const { error: scoreError } = await client
      .from("trivia_players" as never)
      .update({ score: playerRow.score + points } as never)
      .eq("id", playerRow.id);
    if (scoreError) return { ok: false as const, message: scoreError.message };
  }

  return {
    ok: true as const,
    message: correct ? "Locked in." : "Locked in.",
    correct: null as boolean | null,
    pointsAwarded: null as number | null,
  };
}

export async function getPlayerState(
  client: AnyClient,
  playerToken: string,
  now: Date = new Date(),
): Promise<{ state: TriviaPlayerState | null; error: string | null }> {
  const { data: player, error: playerError } = await client
    .from("trivia_players" as never)
    .select("id, session_id, display_name, score, player_token")
    .eq("player_token", playerToken)
    .maybeSingle();
  if (playerError) return { state: null, error: playerError.message };
  if (!player) return { state: null, error: null };
  const playerRow = player as { id: string; session_id: string; display_name: string; score: number };

  const { data: session, error: sessionError } = await client
    .from("trivia_sessions" as never)
    .select(
      "id, venue_id, pack_id, join_code, status, current_question_index, question_count, phase_ends_at, lobby_seconds, question_seconds, reveal_seconds, podium_seconds, final_seconds, started_at",
    )
    .eq("id", playerRow.session_id)
    .maybeSingle();
  if (sessionError) return { state: null, error: sessionError.message };
  if (!session) return { state: null, error: null };

  let current = session as SessionRow;
  const advanced = await advanceTriviaSession(client, current, now);
  if (advanced.error) return { state: null, error: advanced.error };
  current = advanced.session;
  if (!isActiveTriviaStatus(current.status)) return { state: null, error: null };

  const [playersRes, questionRes, answerRes] = await Promise.all([
    loadPlayers(client, current.id),
    current.status === "lobby" || current.status === "final"
      ? Promise.resolve({ question: null as QuestionSnap | null, error: null as string | null })
      : loadSessionQuestion(client, current.id, current.current_question_index),
    client
      .from("trivia_answers" as never)
      .select("choice_index, points_awarded")
      .eq("session_id", current.id)
      .eq("player_id", playerRow.id)
      .eq("question_index", current.current_question_index)
      .maybeSingle(),
  ]);

  if (playersRes.error) return { state: null, error: playersRes.error };
  if (questionRes.error) return { state: null, error: questionRes.error };

  const answer = answerRes.data as { choice_index: number; points_awarded: number } | null;
  const showResult = current.status === "reveal" || current.status === "podium" || current.status === "final";
  const freshPlayer = playersRes.players.find((item) => item.id === playerRow.id);

  return {
    state: {
      playerId: playerRow.id,
      displayName: playerRow.display_name,
      score: freshPlayer?.score ?? playerRow.score,
      sessionId: current.id,
      joinCode: current.join_code,
      status: current.status,
      currentQuestionIndex: current.current_question_index,
      questionCount: current.question_count,
      phaseEndsAt: current.phase_ends_at,
      question: wallQuestionFromRow(questionRes.question, current.status),
      myChoiceIndex: answer?.choice_index ?? null,
      answered: Boolean(answer),
      lastAward: showResult ? (answer?.points_awarded ?? 0) : null,
      rank: playerRank(playersRes.players, playerRow.id),
      serverNow: now.toISOString(),
    },
    error: null,
  };
}
