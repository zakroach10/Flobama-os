import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applyVoteCounts,
  choiceLabelsForTool,
  createAudienceJoinCode,
  isAudienceGuestTokenConflict,
  isAudienceToolKind,
  normalizeAudienceDisplayName,
} from "@/lib/audience/engine";
import {
  assertGuessReadyForWall,
  buildGuessView,
  guessRoundKey,
  isGuessToolKind,
  newGuessRoundId,
  parseGuessPlayers,
  prepareCreatedGuessPayload,
  redactGuessPayload,
  sanitizeGuessLyricPayload,
  sanitizeGuessPlayerPayload,
  staffGuessRound,
} from "@/lib/audience/guess";
import { readAudienceVenueSettings } from "@/lib/audience/settings";
import type {
  AudienceGuessBubble,
  AudienceGuessView,
  AudienceGuestState,
  AudienceToolKind,
  AudienceWallState,
  AudienceWallTool,
} from "@/lib/audience/types";
import { mapJoinRows } from "@/lib/screens/join-notices";

type AnyClient = SupabaseClient;

type SessionRow = {
  id: string;
  venue_id: string;
  title: string;
  join_code: string;
  status: string;
  active_tool_id: string | null;
  voting_open: boolean;
  results_revealed: boolean;
};

type ToolRow = {
  id: string;
  kind: string;
  title: string;
  status: string;
  payload: Record<string, unknown> | null;
};

async function loadLiveSession(client: AnyClient, venueId: string) {
  const { data, error } = await client
    .from("audience_sessions" as never)
    .select("id, venue_id, title, join_code, status, active_tool_id, voting_open, results_revealed")
    .eq("venue_id", venueId)
    .eq("status", "live")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { session: null as SessionRow | null, error: error.message };
  return { session: (data as SessionRow | null) ?? null, error: null };
}

async function loadSessionByCode(client: AnyClient, joinCode: string) {
  const { data, error } = await client
    .from("audience_sessions" as never)
    .select("id, venue_id, title, join_code, status, active_tool_id, voting_open, results_revealed")
    .eq("join_code", joinCode.toUpperCase())
    .eq("status", "live")
    .maybeSingle();
  if (error) return { session: null as SessionRow | null, error: error.message };
  return { session: (data as SessionRow | null) ?? null, error: null };
}

async function loadTool(client: AnyClient, toolId: string | null) {
  if (!toolId) return null;
  const { data } = await client
    .from("audience_tools" as never)
    .select("id, kind, title, status, payload")
    .eq("id", toolId)
    .maybeSingle();
  return (data as ToolRow | null) ?? null;
}

async function loadTallies(client: AnyClient, tool: ToolRow | null) {
  if (!tool || !isAudienceToolKind(tool.kind)) {
    return { tallies: [], totalVotes: 0 };
  }
  const base = choiceLabelsForTool(tool.kind, (tool.payload as Record<string, unknown>) ?? {});
  if (base.length === 0) return { tallies: [], totalVotes: 0 };
  const { data } = await client
    .from("audience_votes" as never)
    .select("choice_key")
    .eq("tool_id", tool.id);
  return applyVoteCounts(base, (data as Array<{ choice_key: string }> | null) ?? []);
}

async function loadQuestionOnWall(client: AnyClient, sessionId: string) {
  const { data } = await client
    .from("audience_questions" as never)
    .select("id, display_name, body")
    .eq("session_id", sessionId)
    .eq("status", "on_wall")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = data as { id: string; display_name: string; body: string } | null;
  if (!row) return null;
  return { id: row.id, displayName: row.display_name, body: row.body };
}

async function guestCount(client: AnyClient, sessionId: string) {
  const { count } = await client
    .from("audience_guests" as never)
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);
  return count ?? 0;
}

async function loadRecentJoins(client: AnyClient, sessionId: string) {
  const { data, error } = await client
    .from("audience_guests" as never)
    .select("id, display_name, joined_at")
    .eq("session_id", sessionId)
    .order("joined_at", { ascending: false })
    .limit(16);
  if (error) return [];
  return mapJoinRows(
    (data as Array<{ id: string; display_name: string; joined_at: string }> | null) ?? [],
  );
}

export async function loadAudienceBrandLogo(client: AnyClient, venueId: string) {
  const settings = await readAudienceVenueSettings(client, venueId);
  if (!settings.ok) return null;
  return settings.settings.row.brandLogoUrl;
}

function toWallTool(
  tool: ToolRow,
  votingOpen: boolean,
  resultsRevealed: boolean,
  tallies: Awaited<ReturnType<typeof loadTallies>>,
  questionOnWall: Awaited<ReturnType<typeof loadQuestionOnWall>>,
  guess: AudienceGuessView | null,
): AudienceWallTool | null {
  if (!isAudienceToolKind(tool.kind)) return null;
  const rawPayload = (tool.payload as Record<string, unknown>) ?? {};
  return {
    id: tool.id,
    kind: tool.kind,
    title: tool.title,
    payload: isGuessToolKind(tool.kind) ? redactGuessPayload(tool.kind, rawPayload) : rawPayload,
    votingOpen,
    resultsRevealed,
    // Keep keys for phone voting; hide counts on the wall until hosts reveal.
    tallies: resultsRevealed
      ? tallies.tallies
      : tallies.tallies.map((row) => ({ ...row, count: 0 })),
    totalVotes: tallies.totalVotes,
    questionOnWall,
    guess,
  };
}

async function loadGuessView(client: AnyClient, tool: ToolRow | null): Promise<AudienceGuessView | null> {
  if (!tool || !isGuessToolKind(tool.kind)) return null;
  const payload = (tool.payload as Record<string, unknown>) ?? {};
  const roundKey = guessRoundKey(tool.kind, payload);
  if (!roundKey) {
    return buildGuessView({ kind: tool.kind, payload, submissions: [] });
  }
  const { data, error } = await client
    .from("audience_guess_submissions" as never)
    .select("id, display_name, answer, correct, won, created_at")
    .eq("tool_id", tool.id)
    .eq("round_key", roundKey)
    .order("created_at", { ascending: false })
    .limit(24);
  if (error) {
    return buildGuessView({ kind: tool.kind, payload, submissions: [] });
  }
  const submissions = mapGuessRows(
    (data as Array<{
      id: string;
      display_name: string;
      answer: string;
      correct: boolean;
      won: boolean;
      created_at: string;
    }> | null) ?? [],
  );
  return buildGuessView({ kind: tool.kind, payload, submissions });
}

function mapGuessRows(
  rows: Array<{
    id: string;
    display_name: string;
    answer: string;
    correct: boolean;
    won: boolean;
    created_at: string;
  }>,
): AudienceGuessBubble[] {
  return rows.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    answer: row.answer,
    correct: row.correct,
    won: row.won,
    createdAt: row.created_at,
  }));
}

export async function getAudienceWallState(
  client: AnyClient,
  venueId: string,
): Promise<{ ok: true; wall: AudienceWallState | null } | { ok: false; message: string }> {
  const { session, error } = await loadLiveSession(client, venueId);
  if (error) return { ok: false, message: error };
  if (!session) return { ok: true, wall: null };

  const tool = await loadTool(client, session.active_tool_id);
  const tallies = await loadTallies(client, tool);
  const questionOnWall = tool?.kind === "questions" ? await loadQuestionOnWall(client, session.id) : null;
  const guess = tool && tool.status === "on_wall" ? await loadGuessView(client, tool) : null;
  const wallTool =
    tool && tool.status === "on_wall"
      ? toWallTool(tool, session.voting_open, session.results_revealed, tallies, questionOnWall, guess)
      : null;
  const chrome = await readAudienceVenueSettings(client, venueId);

  return {
    ok: true,
    wall: {
      sessionId: session.id,
      title: session.title,
      joinCode: session.join_code,
      joinPath: `/live/${session.join_code}`,
      guestCount: await guestCount(client, session.id),
      brandLogoUrl: chrome.ok ? chrome.settings.row.brandLogoUrl : null,
      cornerSponsor: chrome.ok ? chrome.settings.cornerSponsor : null,
      tool: wallTool,
      recentJoins: await loadRecentJoins(client, session.id),
      lobbyMessage: wallTool
        ? "Live on the wall — scan to join"
        : "Scan to join — waiting for the next interaction",
    },
  };
}

export async function startAudienceSession(
  client: AnyClient,
  input: { venueId: string; title: string; startedBy: string },
): Promise<{ ok: true; sessionId: string; joinCode: string } | { ok: false; message: string }> {
  const existing = await loadLiveSession(client, input.venueId);
  if (existing.error) return { ok: false, message: existing.error };
  if (existing.session) {
    return { ok: true, sessionId: existing.session.id, joinCode: existing.session.join_code };
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const joinCode = createAudienceJoinCode();
    const { data, error } = await client
      .from("audience_sessions" as never)
      .insert({
        venue_id: input.venueId,
        title: input.title.trim() || "Live show",
        join_code: joinCode,
        status: "live",
        started_by: input.startedBy,
      } as never)
      .select("id, join_code")
      .single();
    if (!error && data) {
      const row = data as { id: string; join_code: string };
      return { ok: true, sessionId: row.id, joinCode: row.join_code };
    }
    if (error && !/duplicate|unique/i.test(error.message)) {
      return { ok: false, message: error.message };
    }
  }
  return { ok: false, message: "Could not allocate a join code." };
}

export async function endAudienceSession(
  client: AnyClient,
  venueId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { session, error } = await loadLiveSession(client, venueId);
  if (error) return { ok: false, message: error };
  if (!session) return { ok: true };
  const { error: updateError } = await client
    .from("audience_sessions" as never)
    .update({
      status: "ended",
      ended_at: new Date().toISOString(),
      active_tool_id: null,
    } as never)
    .eq("id", session.id);
  if (updateError) return { ok: false, message: updateError.message };
  await client
    .from("audience_tools" as never)
    .update({ status: "archived" } as never)
    .eq("session_id", session.id)
    .eq("status", "on_wall");
  return { ok: true };
}

export async function createAudienceTool(
  client: AnyClient,
  input: {
    venueId: string;
    sessionId: string;
    kind: AudienceToolKind;
    title: string;
    payload: Record<string, unknown>;
    createdBy: string;
  },
): Promise<{ ok: true; toolId: string } | { ok: false; message: string }> {
  const prepared = prepareCreatedGuessPayload(input.kind, input.payload, input.venueId);
  if (!prepared.ok) return prepared;
  const { data, error } = await client
    .from("audience_tools" as never)
    .insert({
      session_id: input.sessionId,
      venue_id: input.venueId,
      kind: input.kind,
      title: input.title.trim(),
      status: "ready",
      payload: prepared.payload,
      created_by: input.createdBy,
    } as never)
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "Could not create tool." };
  return { ok: true, toolId: (data as { id: string }).id };
}

export async function putToolOnWall(
  client: AnyClient,
  input: { venueId: string; toolId: string; resultsRevealed?: boolean; votingOpen?: boolean },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { session, error } = await loadLiveSession(client, input.venueId);
  if (error) return { ok: false, message: error };
  if (!session) return { ok: false, message: "Start an audience session first." };

  const tool = await loadTool(client, input.toolId);
  if (!tool) return { ok: false, message: "Tool not found." };
  if (isAudienceToolKind(tool.kind)) {
    const ready = assertGuessReadyForWall(
      tool.kind,
      (tool.payload as Record<string, unknown>) ?? {},
      input.venueId,
    );
    if (!ready.ok) return ready;
  }

  await client
    .from("audience_tools" as never)
    .update({ status: "ready" } as never)
    .eq("session_id", session.id)
    .eq("status", "on_wall");

  const { error: toolError } = await client
    .from("audience_tools" as never)
    .update({ status: "on_wall" } as never)
    .eq("id", input.toolId)
    .eq("session_id", session.id);
  if (toolError) return { ok: false, message: toolError.message };

  const { error: sessionError } = await client
    .from("audience_sessions" as never)
    .update({
      active_tool_id: input.toolId,
      results_revealed: input.resultsRevealed ?? false,
      voting_open: input.votingOpen ?? true,
    } as never)
    .eq("id", session.id);
  if (sessionError) return { ok: false, message: sessionError.message };
  return { ok: true };
}

export async function clearWallTool(
  client: AnyClient,
  venueId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { session, error } = await loadLiveSession(client, venueId);
  if (error) return { ok: false, message: error };
  if (!session) return { ok: true };
  if (session.active_tool_id) {
    await client
      .from("audience_tools" as never)
      .update({ status: "ready" } as never)
      .eq("id", session.active_tool_id);
  }
  const { error: sessionError } = await client
    .from("audience_sessions" as never)
    .update({ active_tool_id: null, results_revealed: false } as never)
    .eq("id", session.id);
  if (sessionError) return { ok: false, message: sessionError.message };
  return { ok: true };
}

export async function setAudienceReveal(
  client: AnyClient,
  venueId: string,
  resultsRevealed: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { session, error } = await loadLiveSession(client, venueId);
  if (error) return { ok: false, message: error };
  if (!session) return { ok: false, message: "No live audience session." };
  const { error: updateError } = await client
    .from("audience_sessions" as never)
    .update({ results_revealed: resultsRevealed } as never)
    .eq("id", session.id);
  if (updateError) return { ok: false, message: updateError.message };
  return { ok: true };
}

export async function setAudienceVoting(
  client: AnyClient,
  venueId: string,
  votingOpen: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { session, error } = await loadLiveSession(client, venueId);
  if (error) return { ok: false, message: error };
  if (!session) return { ok: false, message: "No live audience session." };
  const { error: updateError } = await client
    .from("audience_sessions" as never)
    .update({ voting_open: votingOpen } as never)
    .eq("id", session.id);
  if (updateError) return { ok: false, message: updateError.message };
  return { ok: true };
}

export async function updateToolPayload(
  client: AnyClient,
  input: { venueId: string; toolId: string; payload: Record<string, unknown>; title?: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const existing = await client
    .from("audience_tools" as never)
    .select("id, kind, status, payload")
    .eq("id", input.toolId)
    .eq("venue_id", input.venueId)
    .maybeSingle();
  if (existing.error) return { ok: false, message: existing.error.message };
  const row = existing.data as { kind: string; status: string; payload: Record<string, unknown> | null } | null;
  if (!row) return { ok: false, message: "Tool not found." };

  let payload = input.payload;
  if (isGuessToolKind(row.kind)) {
    const mode = row.status === "on_wall" ? "live" : "draft";
    const sanitized =
      row.kind === "guess_player"
        ? sanitizeGuessPlayerPayload(input.payload, input.venueId, mode)
        : sanitizeGuessLyricPayload(input.payload, mode);
    if (!sanitized.ok) return sanitized;
    // Keep the live lyric round id unless the host explicitly starts a new round.
    if (row.kind === "guess_lyric") {
      const currentRound = String((row.payload ?? {}).roundId ?? "");
      payload = { ...sanitized.payload, roundId: currentRound || sanitized.payload.roundId };
    } else if (row.status === "on_wall") {
      const currentActive = String((row.payload ?? {}).activePlayerId ?? "");
      payload = {
        ...sanitized.payload,
        activePlayerId: currentActive || sanitized.payload.activePlayerId,
      };
    } else {
      payload = sanitized.payload;
    }
  }

  const patch: Record<string, unknown> = { payload };
  if (input.title?.trim()) patch.title = input.title.trim();
  const { error } = await client
    .from("audience_tools" as never)
    .update(patch as never)
    .eq("id", input.toolId)
    .eq("venue_id", input.venueId);
  if (error) return { ok: false, message: error.message };
  if (row.kind === "guess_player") {
    const previous = parseGuessPlayers((row.payload ?? {}) as Record<string, unknown>);
    const next = parseGuessPlayers(payload);
    const stillUsed = new Set(next.map((player) => player.storagePath).filter(Boolean));
    const remove = previous
      .map((player) => player.storagePath)
      .filter((path) => path && !stillUsed.has(path) && path.startsWith(`${input.venueId}/audience/`));
    if (remove.length > 0) {
      await client.storage.from("screen-ads").remove(remove);
    }
  }
  return { ok: true };
}

async function moveGuestToSession(
  client: AnyClient,
  input: { guestToken: string; sessionId: string; venueId: string; displayName: string },
) {
  const { error } = await client
    .from("audience_guests" as never)
    .update({
      session_id: input.sessionId,
      venue_id: input.venueId,
      display_name: input.displayName,
      joined_at: new Date().toISOString(),
    } as never)
    .eq("guest_token", input.guestToken);
  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const };
}

export async function joinAudienceSession(
  client: AnyClient,
  input: { joinCode: string; displayName: string; guestToken: string },
): Promise<{ ok: true; state: AudienceGuestState } | { ok: false; message: string }> {
  const { session, error } = await loadSessionByCode(client, input.joinCode);
  if (error) return { ok: false, message: error };
  if (!session) return { ok: false, message: "No live show found for that code." };

  const displayName = normalizeAudienceDisplayName(input.displayName);
  if (displayName.length < 1) return { ok: false, message: "Enter a display name." };

  const { data: existing, error: existingError } = await client
    .from("audience_guests" as never)
    .select("id, session_id")
    .eq("guest_token", input.guestToken)
    .maybeSingle();
  if (existingError) return { ok: false, message: existingError.message };

  if (!existing) {
    const { error: insertError } = await client.from("audience_guests" as never).insert({
      session_id: session.id,
      venue_id: session.venue_id,
      display_name: displayName,
      guest_token: input.guestToken,
    } as never);
    if (insertError) {
      if (!isAudienceGuestTokenConflict(insertError)) return { ok: false, message: insertError.message };
      const moved = await moveGuestToSession(client, {
        guestToken: input.guestToken,
        sessionId: session.id,
        venueId: session.venue_id,
        displayName,
      });
      if (!moved.ok) return moved;
    }
  } else {
    const row = existing as { id: string; session_id: string };
    const patch: Record<string, unknown> = {
      display_name: displayName,
      venue_id: session.venue_id,
    };
    if (row.session_id !== session.id) {
      patch.session_id = session.id;
      patch.joined_at = new Date().toISOString();
    }
    const { error: updateError } = await client
      .from("audience_guests" as never)
      .update(patch as never)
      .eq("id", row.id);
    if (updateError) return { ok: false, message: updateError.message };
  }

  const state = await getGuestState(client, session, input.guestToken);
  if (!state) return { ok: false, message: "Could not load guest state." };
  return { ok: true, state };
}

async function getGuestState(
  client: AnyClient,
  session: SessionRow,
  guestToken: string,
): Promise<AudienceGuestState | null> {
  const { data: guest } = await client
    .from("audience_guests" as never)
    .select("id, display_name")
    .eq("guest_token", guestToken)
    .eq("session_id", session.id)
    .maybeSingle();
  if (!guest) return null;
  const guestRow = guest as { id: string; display_name: string };

  const tool = await loadTool(client, session.active_tool_id);
  const tallies = await loadTallies(client, tool);
  const questionOnWall = tool?.kind === "questions" ? await loadQuestionOnWall(client, session.id) : null;
  const guess = tool && tool.status === "on_wall" ? await loadGuessView(client, tool) : null;
  const wallTool =
    tool && tool.status === "on_wall"
      ? toWallTool(tool, session.voting_open, session.results_revealed, tallies, questionOnWall, guess)
      : null;

  let myVote: string | null = null;
  if (tool) {
    const { data: vote } = await client
      .from("audience_votes" as never)
      .select("choice_key")
      .eq("tool_id", tool.id)
      .eq("guest_id", guestRow.id)
      .maybeSingle();
    myVote = (vote as { choice_key: string } | null)?.choice_key ?? null;
  }

  return {
    sessionId: session.id,
    joinCode: session.join_code,
    displayName: guestRow.display_name,
    votingOpen: session.voting_open,
    resultsRevealed: session.results_revealed,
    tool: wallTool,
    myVote,
    canSubmitQuestion: Boolean(tool && tool.kind === "questions" && tool.status === "on_wall"),
  };
}

export async function getAudienceGuestStateByToken(
  client: AnyClient,
  guestToken: string,
): Promise<{ ok: true; state: AudienceGuestState | null } | { ok: false; message: string }> {
  const { data: guest, error } = await client
    .from("audience_guests" as never)
    .select("session_id")
    .eq("guest_token", guestToken)
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!guest) return { ok: true, state: null };

  const { data: session, error: sessionError } = await client
    .from("audience_sessions" as never)
    .select("id, venue_id, title, join_code, status, active_tool_id, voting_open, results_revealed")
    .eq("id", (guest as { session_id: string }).session_id)
    .eq("status", "live")
    .maybeSingle();
  if (sessionError) return { ok: false, message: sessionError.message };
  if (!session) return { ok: true, state: null };
  const state = await getGuestState(client, session as SessionRow, guestToken);
  return { ok: true, state };
}

export async function castAudienceVote(
  client: AnyClient,
  input: { guestToken: string; choiceKey: string },
): Promise<{ ok: true; state: AudienceGuestState } | { ok: false; message: string }> {
  const loaded = await getAudienceGuestStateByToken(client, input.guestToken);
  if (!loaded.ok) return loaded;
  if (!loaded.state?.tool) return { ok: false, message: "Nothing to vote on right now." };
  if (!loaded.state.votingOpen) return { ok: false, message: "Voting is closed." };

  const kind = loaded.state.tool.kind;
  if (kind !== "poll" && kind !== "hot_take" && kind !== "host_picks") {
    return { ok: false, message: "This screen is not a vote." };
  }
  const allowed = loaded.state.tool.tallies.map((row) => row.key);
  // When results hidden, tallies still have keys with zero counts.
  if (!allowed.includes(input.choiceKey)) {
    return { ok: false, message: "Invalid choice." };
  }

  const { data: guest } = await client
    .from("audience_guests" as never)
    .select("id, session_id")
    .eq("guest_token", input.guestToken)
    .eq("session_id", loaded.state.sessionId)
    .maybeSingle();
  if (!guest) return { ok: false, message: "Join the show first." };
  const guestRow = guest as { id: string; session_id: string };

  const { error } = await client.from("audience_votes" as never).upsert(
    {
      session_id: guestRow.session_id,
      tool_id: loaded.state.tool.id,
      guest_id: guestRow.id,
      choice_key: input.choiceKey,
    } as never,
    { onConflict: "tool_id,guest_id" },
  );
  if (error) return { ok: false, message: error.message };

  const next = await getAudienceGuestStateByToken(client, input.guestToken);
  if (!next.ok || !next.state) return { ok: false, message: "Vote saved but state reload failed." };
  return { ok: true, state: next.state };
}

export async function submitAudienceQuestion(
  client: AnyClient,
  input: { guestToken: string; body: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const loaded = await getAudienceGuestStateByToken(client, input.guestToken);
  if (!loaded.ok) return loaded;
  if (!loaded.state?.canSubmitQuestion) return { ok: false, message: "Question submissions are closed." };
  const body = input.body.trim().slice(0, 280);
  if (body.length < 3) return { ok: false, message: "Question is too short." };

  const { data: guest } = await client
    .from("audience_guests" as never)
    .select("id, venue_id, display_name, session_id")
    .eq("guest_token", input.guestToken)
    .eq("session_id", loaded.state.sessionId)
    .maybeSingle();
  if (!guest) return { ok: false, message: "Join the show first." };
  const guestRow = guest as { id: string; venue_id: string; display_name: string; session_id: string };

  const { error } = await client.from("audience_questions" as never).insert({
    session_id: guestRow.session_id,
    venue_id: guestRow.venue_id,
    guest_id: guestRow.id,
    display_name: guestRow.display_name,
    body,
    status: "pending",
  } as never);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function moderateAudienceQuestion(
  client: AnyClient,
  input: { venueId: string; questionId: string; status: "approved" | "on_wall" | "rejected" | "done" },
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (input.status === "on_wall") {
    await client
      .from("audience_questions" as never)
      .update({ status: "approved" } as never)
      .eq("venue_id", input.venueId)
      .eq("status", "on_wall");
  }
  const { error } = await client
    .from("audience_questions" as never)
    .update({ status: input.status } as never)
    .eq("id", input.questionId)
    .eq("venue_id", input.venueId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function saveAudiencePreset(
  client: AnyClient,
  input: {
    venueId: string;
    kind: AudienceToolKind;
    name: string;
    title: string;
    payload: Record<string, unknown>;
    createdBy: string;
  },
): Promise<{ ok: true; presetId: string } | { ok: false; message: string }> {
  const prepared = prepareCreatedGuessPayload(input.kind, input.payload, input.venueId);
  if (!prepared.ok) return prepared;
  const presetPayload =
    input.kind === "guess_lyric"
      ? { ...prepared.payload, roundId: "" }
      : prepared.payload;
  const { data, error } = await client
    .from("audience_presets" as never)
    .insert({
      venue_id: input.venueId,
      kind: input.kind,
      name: input.name.trim(),
      title: input.title.trim(),
      payload: presetPayload,
      created_by: input.createdBy,
    } as never)
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "Could not save preset." };
  return { ok: true, presetId: (data as { id: string }).id };
}

export async function deleteAudiencePreset(
  client: AnyClient,
  input: { venueId: string; presetId: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await client
    .from("audience_presets" as never)
    .delete()
    .eq("id", input.presetId)
    .eq("venue_id", input.venueId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function loadAudiencePreset(
  client: AnyClient,
  input: { venueId: string; presetId: string },
): Promise<
  | { ok: true; preset: { id: string; kind: AudienceToolKind; name: string; title: string; payload: Record<string, unknown> } }
  | { ok: false; message: string }
> {
  const { data, error } = await client
    .from("audience_presets" as never)
    .select("id, kind, name, title, payload")
    .eq("id", input.presetId)
    .eq("venue_id", input.venueId)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Preset not found." };
  const row = data as {
    id: string;
    kind: string;
    name: string;
    title: string;
    payload: Record<string, unknown> | null;
  };
  if (!isAudienceToolKind(row.kind)) return { ok: false, message: "Preset kind is not available." };
  return {
    ok: true,
    preset: {
      id: row.id,
      kind: row.kind,
      name: row.name,
      title: row.title,
      payload: row.payload ?? {},
    },
  };
}

type GuessRpcResult = {
  ok?: boolean;
  error?: string;
  correct?: boolean;
  won?: boolean;
  late?: boolean;
};

export async function submitAudienceGuess(
  client: AnyClient,
  input: { guestToken: string; answer: string },
): Promise<
  | { ok: true; state: AudienceGuestState; correct: boolean; won: boolean; late: boolean }
  | { ok: false; message: string }
> {
  const { data, error } = await client.rpc(
    "submit_audience_guess" as never,
    { p_guest_token: input.guestToken, p_answer: input.answer } as never,
  );
  if (error) return { ok: false, message: error.message };
  const row = (data ?? {}) as GuessRpcResult;
  if (!row.ok) return { ok: false, message: row.error ?? "Could not submit that guess." };
  const next = await getAudienceGuestStateByToken(client, input.guestToken);
  if (!next.ok || !next.state) return { ok: false, message: "Guess saved but state reload failed." };
  return {
    ok: true,
    state: next.state,
    correct: Boolean(row.correct),
    won: Boolean(row.won),
    late: Boolean(row.late),
  };
}

export async function advanceGuessPlayer(
  client: AnyClient,
  input: { venueId: string; direction: "next" | "prev" },
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const { session, error } = await loadLiveSession(client, input.venueId);
  if (error) return { ok: false, message: error };
  if (!session?.active_tool_id) return { ok: false, message: "Put Guess the Player on the wall first." };
  const tool = await loadTool(client, session.active_tool_id);
  if (!tool || tool.kind !== "guess_player") {
    return { ok: false, message: "Guess the Player is not on the wall." };
  }
  const ready = sanitizeGuessPlayerPayload(
    (tool.payload as Record<string, unknown>) ?? {},
    input.venueId,
    "live",
  );
  if (!ready.ok) return ready;
  const players = parseGuessPlayers(ready.payload);
  const current = String(ready.payload.activePlayerId ?? "");
  const index = Math.max(0, players.findIndex((player) => player.id === current));
  const nextIndex = input.direction === "next" ? index + 1 : index - 1;
  if (nextIndex < 0) return { ok: true, message: "Already on the first player." };
  if (nextIndex >= players.length) return { ok: true, message: "Already on the last player." };
  const next = players[nextIndex];
  if (!next) return { ok: false, message: "That player is missing." };
  const { error: updateError } = await client
    .from("audience_tools" as never)
    .update({ payload: { ...ready.payload, activePlayerId: next.id } } as never)
    .eq("id", tool.id)
    .eq("venue_id", input.venueId);
  if (updateError) return { ok: false, message: updateError.message };
  return { ok: true, message: `Now showing ${next.name}.` };
}

export async function startGuessLyricRound(
  client: AnyClient,
  input: { venueId: string; toolId: string; prompt: string; songTitle: string; answer: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const sanitized = sanitizeGuessLyricPayload(
    {
      prompt: input.prompt,
      songTitle: input.songTitle,
      answer: input.answer,
      roundId: newGuessRoundId(),
    },
    "live",
  );
  if (!sanitized.ok) return sanitized;
  const { data, error } = await client
    .from("audience_tools" as never)
    .update({
      payload: sanitized.payload,
      title: String(sanitized.payload.prompt ?? "Guess the Lyric"),
    } as never)
    .eq("id", input.toolId)
    .eq("venue_id", input.venueId)
    .eq("kind", "guess_lyric")
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Lyric round not found." };
  return putToolOnWall(client, {
    venueId: input.venueId,
    toolId: input.toolId,
    resultsRevealed: false,
    votingOpen: true,
  });
}

export async function loadStaffGuessRound(client: AnyClient, venueId: string) {
  const { session, error } = await loadLiveSession(client, venueId);
  if (error) return { ok: false as const, message: error };
  if (!session?.active_tool_id) return { ok: true as const, round: null };
  const tool = await loadTool(client, session.active_tool_id);
  if (!tool || !isGuessToolKind(tool.kind) || tool.status !== "on_wall") {
    return { ok: true as const, round: null };
  }
  const payload = (tool.payload as Record<string, unknown>) ?? {};
  const roundKey = guessRoundKey(tool.kind, payload);
  let submissions: AudienceGuessBubble[] = [];
  if (roundKey) {
    const { data, error: subError } = await client
      .from("audience_guess_submissions" as never)
      .select("id, display_name, answer, correct, won, created_at")
      .eq("tool_id", tool.id)
      .eq("round_key", roundKey)
      .order("created_at", { ascending: false })
      .limit(24);
    if (subError) return { ok: false as const, message: subError.message };
    submissions = mapGuessRows(
      (data as Array<{
        id: string;
        display_name: string;
        answer: string;
        correct: boolean;
        won: boolean;
        created_at: string;
      }> | null) ?? [],
    );
  }
  return { ok: true as const, round: staffGuessRound({ kind: tool.kind, payload, submissions }) };
}
