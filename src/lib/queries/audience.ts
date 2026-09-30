import type { SupabaseClient } from "@supabase/supabase-js";
import type { AudienceToolKind, AudienceToolStatus } from "@/lib/audience/types";
import { isMissingAudienceRelation } from "@/lib/audience/engine";

type Client = SupabaseClient;

export type StaffAudienceSession = {
  id: string;
  title: string;
  joinCode: string;
  status: string;
  activeToolId: string | null;
  votingOpen: boolean;
  resultsRevealed: boolean;
  guestCount: number;
  startedAt: string;
};

export type StaffAudienceTool = {
  id: string;
  kind: AudienceToolKind;
  title: string;
  status: AudienceToolStatus;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type StaffAudienceQuestion = {
  id: string;
  displayName: string;
  body: string;
  status: string;
  createdAt: string;
};

export async function loadAudienceWorkspace(client: Client, venueId: string) {
  const sessionRes = await client
    .from("audience_sessions" as never)
    .select("id, title, join_code, status, active_tool_id, voting_open, results_revealed, started_at")
    .eq("venue_id", venueId)
    .eq("status", "live")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sessionRes.error) {
    return {
      session: null as StaffAudienceSession | null,
      tools: [] as StaffAudienceTool[],
      questions: [] as StaffAudienceQuestion[],
      missingTable: isMissingAudienceRelation(sessionRes.error.message),
      error: sessionRes.error.message,
    };
  }

  const row = sessionRes.data as {
    id: string;
    title: string;
    join_code: string;
    status: string;
    active_tool_id: string | null;
    voting_open: boolean;
    results_revealed: boolean;
    started_at: string;
  } | null;

  if (!row) {
    return { session: null, tools: [], questions: [], missingTable: false, error: null };
  }

  const [toolsRes, questionsRes, guestsRes] = await Promise.all([
    client
      .from("audience_tools" as never)
      .select("id, kind, title, status, payload, created_at")
      .eq("session_id", row.id)
      .neq("status", "archived")
      .order("created_at", { ascending: false }),
    client
      .from("audience_questions" as never)
      .select("id, display_name, body, status, created_at")
      .eq("session_id", row.id)
      .order("created_at", { ascending: false })
      .limit(80),
    client
      .from("audience_guests" as never)
      .select("id", { count: "exact", head: true })
      .eq("session_id", row.id),
  ]);

  const tools: StaffAudienceTool[] = ((toolsRes.data as Array<{
    id: string;
    kind: AudienceToolKind;
    title: string;
    status: AudienceToolStatus;
    payload: Record<string, unknown> | null;
    created_at: string;
  }> | null) ?? []).map((tool) => ({
    id: tool.id,
    kind: tool.kind,
    title: tool.title,
    status: tool.status,
    payload: tool.payload ?? {},
    createdAt: tool.created_at,
  }));

  const questions: StaffAudienceQuestion[] = ((questionsRes.data as Array<{
    id: string;
    display_name: string;
    body: string;
    status: string;
    created_at: string;
  }> | null) ?? []).map((q) => ({
    id: q.id,
    displayName: q.display_name,
    body: q.body,
    status: q.status,
    createdAt: q.created_at,
  }));

  return {
    session: {
      id: row.id,
      title: row.title,
      joinCode: row.join_code,
      status: row.status,
      activeToolId: row.active_tool_id,
      votingOpen: row.voting_open,
      resultsRevealed: row.results_revealed,
      guestCount: guestsRes.count ?? 0,
      startedAt: row.started_at,
    } satisfies StaffAudienceSession,
    tools,
    questions,
    missingTable: false,
    error: toolsRes.error?.message ?? questionsRes.error?.message ?? null,
  };
}
