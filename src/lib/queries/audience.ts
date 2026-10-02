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

export type StaffAudienceSettings = {
  brandLogoUrl: string | null;
};

export type StaffAudiencePreset = {
  id: string;
  kind: AudienceToolKind;
  name: string;
  title: string;
  payload: Record<string, unknown>;
  updatedAt: string;
};

export async function loadAudienceWorkspace(client: Client, venueId: string) {
  const [sessionRes, settingsRes, presetsRes] = await Promise.all([
    client
      .from("audience_sessions" as never)
      .select("id, title, join_code, status, active_tool_id, voting_open, results_revealed, started_at")
      .eq("venue_id", venueId)
      .eq("status", "live")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    client
      .from("audience_venue_settings" as never)
      .select("brand_logo_url")
      .eq("venue_id", venueId)
      .maybeSingle(),
    client
      .from("audience_presets" as never)
      .select("id, kind, name, title, payload, updated_at")
      .eq("venue_id", venueId)
      .order("updated_at", { ascending: false }),
  ]);

  const settings: StaffAudienceSettings = {
    brandLogoUrl: (settingsRes.data as { brand_logo_url?: string | null } | null)?.brand_logo_url?.trim() || null,
  };

  const presets: StaffAudiencePreset[] = ((presetsRes.data as Array<{
    id: string;
    kind: AudienceToolKind;
    name: string;
    title: string;
    payload: Record<string, unknown> | null;
    updated_at: string;
  }> | null) ?? [])
    .filter((preset) =>
      ["poll", "host_picks", "questions", "hot_take", "message", "matchup", "sponsor", "countdown"].includes(
        preset.kind,
      ),
    )
    .map((preset) => ({
      id: preset.id,
      kind: preset.kind,
      name: preset.name,
      title: preset.title,
      payload: preset.payload ?? {},
      updatedAt: preset.updated_at,
    }));

  const presetsMissing = Boolean(
    presetsRes.error && isMissingAudienceRelation(presetsRes.error.message),
  );

  if (sessionRes.error) {
    return {
      session: null as StaffAudienceSession | null,
      tools: [] as StaffAudienceTool[],
      questions: [] as StaffAudienceQuestion[],
      presets,
      settings,
      missingTable: isMissingAudienceRelation(sessionRes.error.message),
      missingPresetsTable: presetsMissing,
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
    return {
      session: null,
      tools: [],
      questions: [],
      presets,
      settings,
      missingTable: false,
      missingPresetsTable: presetsMissing,
      error: presetsMissing ? null : presetsRes.error?.message ?? null,
    };
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
    tools: tools.filter((tool) =>
      ["poll", "host_picks", "questions", "hot_take", "message", "matchup", "sponsor", "countdown"].includes(
        tool.kind,
      ),
    ),
    questions,
    presets,
    settings,
    missingTable: false,
    missingPresetsTable: presetsMissing,
    error: toolsRes.error?.message ?? questionsRes.error?.message ?? (presetsMissing ? null : presetsRes.error?.message) ?? null,
  };
}
