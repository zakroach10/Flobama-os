import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingTriviaRelation } from "@/lib/trivia/engine";
import type { TriviaPackSummary, TriviaStaffSession } from "@/lib/trivia/types";

type AnyClient = SupabaseClient;

export async function listTriviaPacks(client: AnyClient, venueId: string) {
  const { data, error } = await client
    .from("trivia_packs" as never)
    .select("id, title, theme, enabled")
    .eq("venue_id", venueId)
    .order("title", { ascending: true });

  if (error) {
    return {
      packs: [] as TriviaPackSummary[],
      missingTable: isMissingTriviaRelation(error.message),
      error: isMissingTriviaRelation(error.message) ? null : error.message,
    };
  }

  const packs = (data as Array<{ id: string; title: string; theme: string; enabled: boolean }> | null) ?? [];
  const withCounts: TriviaPackSummary[] = [];
  for (const pack of packs) {
    const { count } = await client
      .from("trivia_questions" as never)
      .select("id", { count: "exact", head: true })
      .eq("pack_id", pack.id);
    withCounts.push({
      id: pack.id,
      title: pack.title,
      theme: pack.theme,
      enabled: pack.enabled,
      questionCount: count ?? 0,
    });
  }

  return { packs: withCounts, missingTable: false, error: null as string | null };
}

export async function getStaffTriviaSession(client: AnyClient, venueId: string) {
  const { data, error } = await client
    .from("trivia_sessions" as never)
    .select("id, join_code, status, current_question_index, question_count, phase_ends_at, started_at, pack_id")
    .eq("venue_id", venueId)
    .neq("status", "ended")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      session: null as TriviaStaffSession | null,
      missingTable: isMissingTriviaRelation(error.message),
      error: isMissingTriviaRelation(error.message) ? null : error.message,
    };
  }
  if (!data) return { session: null, missingTable: false, error: null as string | null };

  const row = data as {
    id: string;
    join_code: string;
    status: TriviaStaffSession["status"];
    current_question_index: number;
    question_count: number;
    phase_ends_at: string | null;
    started_at: string;
    pack_id: string;
  };

  const [{ data: pack }, { count }] = await Promise.all([
    client.from("trivia_packs" as never).select("title").eq("id", row.pack_id).maybeSingle(),
    client.from("trivia_players" as never).select("id", { count: "exact", head: true }).eq("session_id", row.id),
  ]);

  return {
    session: {
      id: row.id,
      joinCode: row.join_code,
      status: row.status,
      packTitle: (pack as { title?: string } | null)?.title ?? "Trivia",
      currentQuestionIndex: row.current_question_index,
      questionCount: row.question_count,
      phaseEndsAt: row.phase_ends_at,
      playerCount: count ?? 0,
      startedAt: row.started_at,
    } satisfies TriviaStaffSession,
    missingTable: false,
    error: null as string | null,
  };
}
