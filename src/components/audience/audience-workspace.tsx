"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  clearAudienceWallAction,
  createAudienceToolAction,
  endAudienceSessionAction,
  moderateAudienceQuestionAction,
  putAudienceToolOnWallAction,
  setAudienceRevealAction,
  setAudienceVotingAction,
  startAudienceSessionAction,
  updateAudienceToolAction,
} from "@/actions/audience";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { StaffAudienceQuestion, StaffAudienceSession, StaffAudienceTool } from "@/lib/queries/audience";
import { AUDIENCE_TOOL_KINDS, AUDIENCE_TOOL_LABELS, type AudienceToolKind } from "@/lib/audience/types";
import { defaultPayloadForKind } from "@/lib/audience/engine";
import { getPublicAppUrl } from "@/lib/env";

export function AudienceWorkspace({
  session,
  tools,
  questions,
  apiBase,
}: {
  session: StaffAudienceSession | null;
  tools: StaffAudienceTool[];
  questions: StaffAudienceQuestion[];
  apiBase: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedToolId, setSelectedToolId] = useState<string | null>(tools[0]?.id ?? null);
  const selected = tools.find((tool) => tool.id === selectedToolId) ?? tools[0] ?? null;
  const [payloadText, setPayloadText] = useState(() =>
    selected ? JSON.stringify(selected.payload, null, 2) : "",
  );
  const joinUrl = session ? `${apiBase || getPublicAppUrl() || ""}/live/${session.joinCode}` : "";

  const pendingQuestions = useMemo(
    () => questions.filter((q) => q.status === "pending" || q.status === "approved"),
    [questions],
  );

  function refresh() {
    router.refresh();
  }

  function selectTool(tool: StaffAudienceTool) {
    setSelectedToolId(tool.id);
    setPayloadText(JSON.stringify(tool.payload, null, 2));
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Audience Interactor</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Run live polls, host picks, Q&A, hot takes, messages, matchup cards, Pick’em promo, leaderboards,
          sponsor cards, and countdowns on the LED wall. Guests scan the QR / join code from their phones.
        </p>
      </header>

      <section className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Live session</h2>
            {session ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {session.title} · {session.guestCount} guests joined
                </p>
                <p className="font-mono text-3xl tracking-[0.2em]">{session.joinCode}</p>
                <p className="text-xs text-muted-foreground break-all">{joinUrl}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No live session. Start one to put tools on the wall.</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {!session ? (
              <Button
                type="button"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await startAudienceSessionAction({ title: "FloBama Live" });
                    if (!result.ok) toast.error(result.message);
                    else {
                      toast.success(result.message);
                      refresh();
                    }
                  });
                }}
              >
                Start audience session
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await setAudienceVotingAction({ votingOpen: !session.votingOpen });
                      if (!result.ok) toast.error(result.message);
                      else {
                        toast.success(result.message);
                        refresh();
                      }
                    });
                  }}
                >
                  {session.votingOpen ? "Close voting" : "Open voting"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await setAudienceRevealAction({
                        resultsRevealed: !session.resultsRevealed,
                      });
                      if (!result.ok) toast.error(result.message);
                      else {
                        toast.success(result.message);
                        refresh();
                      }
                    });
                  }}
                >
                  {session.resultsRevealed ? "Hide results" : "Reveal results"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await clearAudienceWallAction();
                      if (!result.ok) toast.error(result.message);
                      else {
                        toast.success(result.message);
                        refresh();
                      }
                    });
                  }}
                >
                  Clear wall
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm("End the audience session?")) return;
                    startTransition(async () => {
                      const result = await endAudienceSessionAction();
                      if (!result.ok) toast.error(result.message);
                      else {
                        toast.success(result.message);
                        refresh();
                      }
                    });
                  }}
                >
                  End session
                </Button>
              </>
            )}
          </div>
        </div>
        {session ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant={session.votingOpen ? "default" : "secondary"}>
              {session.votingOpen ? "Voting open" : "Voting closed"}
            </Badge>
            <Badge variant={session.resultsRevealed ? "default" : "secondary"}>
              {session.resultsRevealed ? "Results revealed" : "Results hidden"}
            </Badge>
          </div>
        ) : null}
      </section>

      {session ? (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-lg font-semibold">Add a tool</h2>
          <p className="mt-1 text-sm text-muted-foreground">Create a tool, edit its JSON payload, then put it on the wall.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {AUDIENCE_TOOL_KINDS.map((kind) => (
              <Button
                key={kind}
                type="button"
                variant="outline"
                className="h-auto min-h-14 justify-start whitespace-normal px-3 py-3 text-left"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await createAudienceToolAction({
                      sessionId: session.id,
                      kind,
                      payload: defaultPayloadForKind(kind),
                    });
                    if (!result.ok) toast.error(result.message);
                    else {
                      toast.success(result.message);
                      if (result.toolId) setSelectedToolId(result.toolId);
                      refresh();
                    }
                  });
                }}
              >
                {AUDIENCE_TOOL_LABELS[kind]}
              </Button>
            ))}
          </div>
        </section>
      ) : null}

      {session ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
          <section className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase">Tools</h2>
            {tools.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tools yet.</p>
            ) : (
              <ul className="space-y-2">
                {tools.map((tool) => (
                  <li key={tool.id}>
                    <button
                      type="button"
                      onClick={() => selectTool(tool)}
                      className={`w-full rounded-lg border px-3 py-3 text-left ${
                        selected?.id === tool.id ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                      }`}
                    >
                      <p className="font-medium">{tool.title}</p>
                      <p className="text-xs text-muted-foreground">{AUDIENCE_TOOL_LABELS[tool.kind]}</p>
                      <div className="mt-2">
                        <Badge variant={tool.status === "on_wall" ? "default" : "secondary"}>{tool.status}</Badge>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
            {!selected ? (
              <p className="text-sm text-muted-foreground">Select or create a tool.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">{selected.title}</h2>
                    <p className="text-sm text-muted-foreground">{AUDIENCE_TOOL_LABELS[selected.kind as AudienceToolKind]}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        startTransition(async () => {
                          const result = await putAudienceToolOnWallAction({
                            toolId: selected.id,
                            resultsRevealed: false,
                            votingOpen: true,
                          });
                          if (!result.ok) toast.error(result.message);
                          else {
                            toast.success(result.message);
                            refresh();
                          }
                        });
                      }}
                    >
                      Put on wall
                    </Button>
                  </div>
                </div>

                <QuickEditors
                  key={selected.id}
                  tool={selected}
                  onApply={(nextPayload, title) => {
                    setPayloadText(JSON.stringify(nextPayload, null, 2));
                    startTransition(async () => {
                      const result = await updateAudienceToolAction({
                        toolId: selected.id,
                        payload: nextPayload,
                        title,
                      });
                      if (!result.ok) toast.error(result.message);
                      else {
                        toast.success(result.message);
                        refresh();
                      }
                    });
                  }}
                />

                <div className="space-y-2">
                  <Label htmlFor="payload">Payload JSON</Label>
                  <textarea
                    id="payload"
                    className="min-h-48 w-full rounded-md border bg-background px-3 py-2 font-mono text-xs"
                    value={payloadText}
                    onChange={(event) => setPayloadText(event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        let payload: Record<string, unknown>;
                        try {
                          payload = JSON.parse(payloadText) as Record<string, unknown>;
                        } catch {
                          toast.error("Payload must be valid JSON.");
                          return;
                        }
                        const result = await updateAudienceToolAction({
                          toolId: selected.id,
                          payload,
                        });
                        if (!result.ok) toast.error(result.message);
                        else {
                          toast.success(result.message);
                          refresh();
                        }
                      });
                    }}
                  >
                    Save payload
                  </Button>
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}

      {session ? (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-lg font-semibold">Audience questions</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Approve submissions, then put one on the wall while a Questions tool is live.
          </p>
          {pendingQuestions.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No pending questions.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {pendingQuestions.map((q) => (
                <li key={q.id} className="rounded-lg border px-4 py-3">
                  <p className="font-medium">“{q.body}”</p>
                  <p className="text-xs text-muted-foreground">
                    {q.displayName} · {q.status}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(["approved", "on_wall", "rejected", "done"] as const).map((status) => (
                      <Button
                        key={status}
                        type="button"
                        size="sm"
                        variant={status === "on_wall" ? "default" : "outline"}
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            const result = await moderateAudienceQuestionAction({
                              questionId: q.id,
                              status,
                            });
                            if (!result.ok) toast.error(result.message);
                            else {
                              toast.success(result.message);
                              refresh();
                            }
                          });
                        }}
                      >
                        {status.replaceAll("_", " ")}
                      </Button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}

function QuickEditors({
  tool,
  onApply,
}: {
  tool: StaffAudienceTool;
  onApply: (payload: Record<string, unknown>, title?: string) => void;
}) {
  const [draft, setDraft] = useState(() => ({ ...tool.payload }));
  if (tool.kind === "message") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Message"
          value={String(draft.text ?? "")}
          onChange={(value) => setDraft((prev) => ({ ...prev, text: value }))}
        />
        <Field
          label="Subtitle"
          value={String(draft.subtitle ?? "")}
          onChange={(value) => setDraft((prev) => ({ ...prev, subtitle: value }))}
        />
        <Button type="button" variant="secondary" onClick={() => onApply(draft, String(draft.text ?? tool.title))}>
          Apply message fields
        </Button>
      </div>
    );
  }
  if (tool.kind === "hot_take") {
    return (
      <div className="grid gap-3">
        <Field
          label="Statement"
          value={String(draft.statement ?? "")}
          onChange={(value) => setDraft((prev) => ({ ...prev, statement: value }))}
        />
        <Button type="button" variant="secondary" onClick={() => onApply(draft)}>
          Apply hot take
        </Button>
      </div>
    );
  }
  if (tool.kind === "poll") {
    return (
      <div className="grid gap-3">
        <Field
          label="Prompt"
          value={String(draft.prompt ?? "")}
          onChange={(value) => setDraft((prev) => ({ ...prev, prompt: value }))}
        />
        <Field
          label="Options (comma-separated)"
          value={Array.isArray(draft.options) ? draft.options.join(", ") : ""}
          onChange={(value) =>
            setDraft((prev) => ({
              ...prev,
              options: value
                .split(",")
                .map((part) => part.trim())
                .filter(Boolean),
            }))
          }
        />
        <Button type="button" variant="secondary" onClick={() => onApply(draft)}>
          Apply poll fields
        </Button>
      </div>
    );
  }
  if (tool.kind === "host_picks") {
    const hostA = (draft.hostA ?? {}) as Record<string, unknown>;
    const hostB = (draft.hostB ?? {}) as Record<string, unknown>;
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Prompt"
          value={String(draft.prompt ?? "")}
          onChange={(value) => setDraft((prev) => ({ ...prev, prompt: value }))}
        />
        <Field
          label="Options (comma-separated)"
          value={Array.isArray(draft.options) ? draft.options.join(", ") : ""}
          onChange={(value) =>
            setDraft((prev) => ({
              ...prev,
              options: value
                .split(",")
                .map((part) => part.trim())
                .filter(Boolean),
            }))
          }
        />
        <Field
          label="Austin pick"
          value={String(hostA.pick ?? "")}
          onChange={(value) =>
            setDraft((prev) => ({ ...prev, hostA: { ...hostA, name: "Austin", pick: value } }))
          }
        />
        <Field
          label="Hunter pick"
          value={String(hostB.pick ?? "")}
          onChange={(value) =>
            setDraft((prev) => ({ ...prev, hostB: { ...hostB, name: "Hunter", pick: value } }))
          }
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            onApply({
              ...draft,
              hostA: { ...hostA, name: "Austin", revealed: true },
              hostB: { ...hostB, name: "Hunter", revealed: Boolean(hostB.revealed) },
            })
          }
        >
          Reveal Austin
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            onApply({
              ...draft,
              hostA: { ...hostA, name: "Austin", revealed: Boolean(hostA.revealed) },
              hostB: { ...hostB, name: "Hunter", revealed: true },
            })
          }
        >
          Reveal Hunter
        </Button>
        <Button type="button" variant="secondary" onClick={() => onApply(draft)}>
          Save host picks
        </Button>
      </div>
    );
  }
  return (
    <p className="text-sm text-muted-foreground">
      Edit the JSON payload below for this tool (matchup, sponsor, countdown, Pick’em promo, leaderboard, etc.).
    </p>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
