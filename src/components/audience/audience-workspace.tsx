"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  clearAudienceBrandLogoAction,
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
import { uploadAudienceBrandLogoFromBrowser } from "@/lib/audience/brand-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type {
  StaffAudienceQuestion,
  StaffAudienceSession,
  StaffAudienceSettings,
  StaffAudienceTool,
} from "@/lib/queries/audience";
import {
  AUDIENCE_TOOL_HINTS,
  AUDIENCE_TOOL_KINDS,
  AUDIENCE_TOOL_LABELS,
  type AudienceToolKind,
} from "@/lib/audience/types";
import { defaultPayloadForKind } from "@/lib/audience/engine";
import type { PublicSupabaseEnv } from "@/lib/env";

export function AudienceWorkspace({
  session,
  tools,
  questions,
  settings,
  apiBase,
  venueId,
  supabaseEnv,
}: {
  session: StaffAudienceSession | null;
  tools: StaffAudienceTool[];
  questions: StaffAudienceQuestion[];
  settings: StaffAudienceSettings;
  apiBase: string;
  venueId: string;
  supabaseEnv: PublicSupabaseEnv | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedToolId, setSelectedToolId] = useState<string | null>(tools[0]?.id ?? null);
  const selected = tools.find((tool) => tool.id === selectedToolId) ?? tools[0] ?? null;
  const joinUrl = session ? `${apiBase}/live/${session.joinCode}` : "";

  useEffect(() => {
    if (selectedToolId && !tools.some((tool) => tool.id === selectedToolId)) {
      setSelectedToolId(tools[0]?.id ?? null);
    }
  }, [tools, selectedToolId]);

  const pendingQuestions = useMemo(
    () => questions.filter((q) => q.status === "pending" || q.status === "approved"),
    [questions],
  );

  function refresh() {
    router.refresh();
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Audience Interactor</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Put polls, host picks, questions, messages, and cards on the LED wall. Guests scan the code on their
          phones.
        </p>
      </header>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Show branding</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Set the podcaster logo before you go live. It appears in the top-right of the wall inside a white rounded
          box.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="flex size-24 items-center justify-center overflow-visible rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/10">
            {settings.brandLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={settings.brandLogoUrl}
                alt="Podcaster logo"
                className="max-h-[5.25rem] max-w-[5.25rem] object-contain"
              />
            ) : (
              <span className="px-2 text-center text-xs text-muted-foreground">No logo yet</span>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-logo">Upload logo (PNG, JPG, or WebP)</Label>
            <Input
              id="brand-logo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={pending}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                startTransition(async () => {
                  const result = await uploadAudienceBrandLogoFromBrowser({
                    file,
                    venueId,
                    supabaseEnv,
                  });
                  if (!result.ok) toast.error(result.message);
                  else {
                    toast.success(result.message);
                    refresh();
                  }
                });
              }}
            />
            {settings.brandLogoUrl ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await clearAudienceBrandLogoAction();
                    if (!result.ok) toast.error(result.message);
                    else {
                      toast.success(result.message);
                      refresh();
                    }
                  });
                }}
              >
                Remove logo
              </Button>
            ) : null}
          </div>
        </div>
      </section>

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
                <p className="text-xs break-all text-muted-foreground">{joinUrl}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Set your logo above, then start a session when you’re ready to go live.
              </p>
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
          <h2 className="text-lg font-semibold">Add something to the show</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap a tool, fill in the simple fields, then put it on the wall.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {AUDIENCE_TOOL_KINDS.map((kind) => (
              <Button
                key={kind}
                type="button"
                variant="outline"
                className="h-auto min-h-16 justify-start whitespace-normal px-3 py-3 text-left"
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
                      toast.success(`${AUDIENCE_TOOL_LABELS[kind]} ready — edit it, then put it on the wall.`);
                      if (result.toolId) setSelectedToolId(result.toolId);
                      refresh();
                    }
                  });
                }}
              >
                <span>
                  <span className="block font-semibold">{AUDIENCE_TOOL_LABELS[kind]}</span>
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">
                    {AUDIENCE_TOOL_HINTS[kind]}
                  </span>
                </span>
              </Button>
            ))}
          </div>
        </section>
      ) : null}

      {session ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
          <section className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase">Your tools</h2>
            {tools.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add a tool above to get started.</p>
            ) : (
              <ul className="space-y-2">
                {tools.map((tool) => (
                  <li key={tool.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedToolId(tool.id)}
                      className={`w-full rounded-lg border px-3 py-3 text-left ${
                        selected?.id === tool.id ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                      }`}
                    >
                      <p className="font-medium">{tool.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {AUDIENCE_TOOL_LABELS[tool.kind as AudienceToolKind] ?? tool.kind}
                      </p>
                      <div className="mt-2">
                        <Badge variant={tool.status === "on_wall" ? "default" : "secondary"}>
                          {tool.status === "on_wall" ? "On wall" : "Ready"}
                        </Badge>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
            {!selected ? (
              <p className="text-sm text-muted-foreground">Select a tool to edit.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">
                      {AUDIENCE_TOOL_LABELS[selected.kind as AudienceToolKind] ?? selected.title}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {AUDIENCE_TOOL_HINTS[selected.kind as AudienceToolKind] ?? ""}
                    </p>
                  </div>
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
                          toast.success("It’s on the wall.");
                          refresh();
                        }
                      });
                    }}
                  >
                    Put on wall
                  </Button>
                </div>

                <ToolEditor
                  key={selected.id}
                  tool={selected}
                  pending={pending}
                  onSave={(payload, title) => {
                    startTransition(async () => {
                      const result = await updateAudienceToolAction({
                        toolId: selected.id,
                        payload,
                        title,
                      });
                      if (!result.ok) toast.error(result.message);
                      else {
                        toast.success("Saved.");
                        refresh();
                      }
                    });
                  }}
                />
              </>
            )}
          </section>
        </div>
      ) : null}

      {session ? (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-lg font-semibold">Audience questions</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            When “Audience questions” is on the wall, guest submissions show up here. Approve one, then put it on the
            wall.
          </p>
          {pendingQuestions.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No questions waiting.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {pendingQuestions.map((q) => (
                <li key={q.id} className="rounded-lg border px-4 py-3">
                  <p className="font-medium">“{q.body}”</p>
                  <p className="text-xs text-muted-foreground">
                    {q.displayName} · {q.status}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(
                      [
                        ["approved", "Approve"],
                        ["on_wall", "Put on wall"],
                        ["rejected", "Reject"],
                        ["done", "Done"],
                      ] as const
                    ).map(([status, label]) => (
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
                        {label}
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

function ToolEditor({
  tool,
  pending,
  onSave,
}: {
  tool: StaffAudienceTool;
  pending: boolean;
  onSave: (payload: Record<string, unknown>, title?: string) => void;
}) {
  const [draft, setDraft] = useState(() => ({ ...tool.payload }));
  const kind = tool.kind as AudienceToolKind;

  function save(title?: string) {
    onSave(draft, title);
  }

  if (kind === "message") {
    return (
      <EditorShell pending={pending} onSave={() => save(String(draft.text ?? "Message"))}>
        <Field
          label="Message on the wall"
          value={String(draft.text ?? "")}
          onChange={(value) => setDraft((prev) => ({ ...prev, text: value }))}
        />
        <Field
          label="Smaller line underneath (optional)"
          value={String(draft.subtitle ?? "")}
          onChange={(value) => setDraft((prev) => ({ ...prev, subtitle: value }))}
        />
      </EditorShell>
    );
  }

  if (kind === "hot_take") {
    return (
      <EditorShell pending={pending} onSave={() => save()}>
        <Field
          label="Hot take statement"
          value={String(draft.statement ?? "")}
          onChange={(value) => setDraft((prev) => ({ ...prev, statement: value }))}
        />
      </EditorShell>
    );
  }

  if (kind === "poll") {
    return (
      <EditorShell pending={pending} onSave={() => save(String(draft.prompt ?? "Poll"))}>
        <Field
          label="Question"
          value={String(draft.prompt ?? "")}
          onChange={(value) => setDraft((prev) => ({ ...prev, prompt: value }))}
        />
        <Field
          label="Answer choices (separate with commas)"
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
      </EditorShell>
    );
  }

  if (kind === "host_picks") {
    const hostA = (draft.hostA ?? {}) as Record<string, unknown>;
    const hostB = (draft.hostB ?? {}) as Record<string, unknown>;
    return (
      <EditorShell pending={pending} onSave={() => save(String(draft.prompt ?? "Host picks"))}>
        <Field
          label="Question"
          value={String(draft.prompt ?? "")}
          onChange={(value) => setDraft((prev) => ({ ...prev, prompt: value }))}
        />
        <Field
          label="Choices guests can vote on (comma-separated)"
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
          label="Austin’s pick"
          value={String(hostA.pick ?? "")}
          onChange={(value) =>
            setDraft((prev) => ({ ...prev, hostA: { ...hostA, name: "Austin", pick: value } }))
          }
        />
        <Field
          label="Hunter’s pick"
          value={String(hostB.pick ?? "")}
          onChange={(value) =>
            setDraft((prev) => ({ ...prev, hostB: { ...hostB, name: "Hunter", pick: value } }))
          }
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              onSave({
                ...draft,
                hostA: { ...hostA, name: "Austin", revealed: true },
                hostB: { ...hostB, name: "Hunter", revealed: Boolean(hostB.revealed) },
              })
            }
          >
            Reveal Austin on wall
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              onSave({
                ...draft,
                hostA: { ...hostA, name: "Austin", revealed: Boolean(hostA.revealed) },
                hostB: { ...hostB, name: "Hunter", revealed: true },
              })
            }
          >
            Reveal Hunter on wall
          </Button>
        </div>
      </EditorShell>
    );
  }

  if (kind === "questions") {
    return (
      <EditorShell pending={pending} onSave={() => save()}>
        <Field
          label="Prompt on guest phones"
          value={String(draft.prompt ?? "")}
          onChange={(value) => setDraft((prev) => ({ ...prev, prompt: value }))}
        />
      </EditorShell>
    );
  }

  if (kind === "matchup") {
    return (
      <EditorShell pending={pending} onSave={() => save(`${draft.teamA} vs ${draft.teamB}`)}>
        <Field
          label="Team A"
          value={String(draft.teamA ?? "")}
          onChange={(value) => setDraft((prev) => ({ ...prev, teamA: value }))}
        />
        <Field
          label="Team B"
          value={String(draft.teamB ?? "")}
          onChange={(value) => setDraft((prev) => ({ ...prev, teamB: value }))}
        />
        <Field
          label="Kickoff / when"
          value={String(draft.kickoff ?? "")}
          onChange={(value) => setDraft((prev) => ({ ...prev, kickoff: value }))}
        />
        <Field
          label="Discussion prompt"
          value={String(draft.prompt ?? "")}
          onChange={(value) => setDraft((prev) => ({ ...prev, prompt: value }))}
        />
        <Field
          label="Team A logo URL (optional)"
          value={String(draft.logoA ?? "")}
          onChange={(value) => setDraft((prev) => ({ ...prev, logoA: value }))}
        />
        <Field
          label="Team B logo URL (optional)"
          value={String(draft.logoB ?? "")}
          onChange={(value) => setDraft((prev) => ({ ...prev, logoB: value }))}
        />
      </EditorShell>
    );
  }

  if (kind === "sponsor") {
    return (
      <EditorShell pending={pending} onSave={() => save(String(draft.name ?? "Sponsor"))}>
        <Field
          label="Sponsor name"
          value={String(draft.name ?? "")}
          onChange={(value) => setDraft((prev) => ({ ...prev, name: value }))}
        />
        <Field
          label="Short blurb"
          value={String(draft.blurb ?? "")}
          onChange={(value) => setDraft((prev) => ({ ...prev, blurb: value }))}
        />
        <Field
          label="Image URL (optional)"
          value={String(draft.imageUrl ?? "")}
          onChange={(value) => setDraft((prev) => ({ ...prev, imageUrl: value }))}
        />
      </EditorShell>
    );
  }

  if (kind === "countdown") {
    return (
      <EditorShell pending={pending} onSave={() => save(String(draft.label ?? "Countdown"))}>
        <Field
          label="Label on the wall"
          value={String(draft.label ?? "")}
          onChange={(value) => setDraft((prev) => ({ ...prev, label: value }))}
        />
        <Field
          label="Seconds to show (example: 120)"
          value={String(draft.seconds ?? 120)}
          onChange={(value) => setDraft((prev) => ({ ...prev, seconds: Number(value) || 0, endsAt: null }))}
        />
      </EditorShell>
    );
  }

  return <p className="text-sm text-muted-foreground">This tool isn’t available.</p>;
}

function EditorShell({
  children,
  pending,
  onSave,
}: {
  children: React.ReactNode;
  pending: boolean;
  onSave: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
      <Button type="button" variant="secondary" disabled={pending} onClick={onSave}>
        Save changes
      </Button>
    </div>
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
