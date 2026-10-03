"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  clearAudienceBrandLogoAction,
  clearAudienceWallAction,
  deleteAudiencePresetAction,
  endAudienceSessionAction,
  moderateAudienceQuestionAction,
  pollAudienceInboxAction,
  putAudiencePresetOnWallAction,
  putAudienceToolOnWallAction,
  saveAudienceCornerSponsorAction,
  saveAudiencePresetAction,
  setAudienceRevealAction,
  setAudienceVotingAction,
  startAudienceSessionAction,
  updateAudienceToolAction,
} from "@/actions/audience";
import { uploadAudienceBrandLogoFromBrowser } from "@/lib/audience/brand-upload";
import { uploadAudiencePictureFromBrowser } from "@/lib/audience/picture-upload";
import { CornerSponsorPanel } from "@/components/audience/corner-sponsor-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  StaffAudiencePreset,
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
import { AUDIENCE_POLL_MS } from "@/lib/constants";
import type { PublicSupabaseEnv } from "@/lib/env";

const REVEALABLE_KINDS = new Set<AudienceToolKind>(["poll", "host_picks", "hot_take"]);

export function AudienceWorkspace({
  session,
  tools,
  questions,
  presets,
  settings,
  apiBase,
  venueId,
  supabaseEnv,
  missingPresetsTable,
  missingCornerSponsor,
  missingCornerSponsorContact,
}: {
  session: StaffAudienceSession | null;
  tools: StaffAudienceTool[];
  questions: StaffAudienceQuestion[];
  presets: StaffAudiencePreset[];
  settings: StaffAudienceSettings;
  apiBase: string;
  venueId: string;
  supabaseEnv: PublicSupabaseEnv | null;
  missingPresetsTable?: boolean;
  missingCornerSponsor?: boolean;
  missingCornerSponsorContact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [polledQuestions, setPolledQuestions] = useState<StaffAudienceQuestion[] | null>(null);
  const [polledGuestCount, setPolledGuestCount] = useState<number | null>(null);
  const seenQuestionIds = useRef<Set<string> | null>(null);
  const [presetKindFilter, setPresetKindFilter] = useState<AudienceToolKind | "all">("all");
  const [presetName, setPresetName] = useState("");
  const [brandOpen, setBrandOpen] = useState(false);
  const [cornerOpen, setCornerOpen] = useState(false);
  const [confirmStartOpen, setConfirmStartOpen] = useState(false);
  const liveTool = tools.find((tool) => tool.status === "on_wall") ?? null;
  const joinUrl = session ? `${apiBase}/live/${session.joinCode}` : "";
  const liveKind = liveTool ? (liveTool.kind as AudienceToolKind) : null;
  const showRevealControls = Boolean(session && liveKind && REVEALABLE_KINDS.has(liveKind));

  const questionsKey = questions.map((question) => `${question.id}:${question.status}:${question.body}`).join("|");
  const [questionsSnapshot, setQuestionsSnapshot] = useState(questionsKey);
  if (questionsKey !== questionsSnapshot) {
    setQuestionsSnapshot(questionsKey);
    setPolledQuestions(null);
    setPolledGuestCount(null);
  }
  const liveQuestions = polledQuestions ?? questions;
  const guestCount = polledGuestCount ?? session?.guestCount ?? 0;

  const liveSessionId = session?.id ?? null;
  useEffect(() => {
    if (!liveSessionId) return;
    let cancelled = false;
    async function pull() {
      const result = await pollAudienceInboxAction();
      if (cancelled || !result.ok) return;
      setPolledQuestions((current) => {
        const baseline = current ?? questions;
        if (
          baseline.length === result.questions.length &&
          baseline.every((question, index) => {
            const next = result.questions[index];
            return (
              next &&
              question.id === next.id &&
              question.status === next.status &&
              question.body === next.body &&
              question.displayName === next.displayName
            );
          })
        ) {
          return current;
        }
        return result.questions;
      });
      setPolledGuestCount((current) => (current === result.guestCount ? current : result.guestCount));
    }
    void pull();
    const id = window.setInterval(() => void pull(), AUDIENCE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [liveSessionId, questions]);

  useEffect(() => {
    const known = seenQuestionIds.current;
    if (known === null) {
      seenQuestionIds.current = new Set(liveQuestions.map((question) => question.id));
      return;
    }
    for (const question of liveQuestions) {
      if (known.has(question.id)) continue;
      known.add(question.id);
      if (question.status === "pending") {
        toast.message(`${question.displayName} asked a question`, { description: question.body });
      }
    }
  }, [liveQuestions]);

  const pendingQuestions = useMemo(
    () => liveQuestions.filter((q) => q.status === "pending" || q.status === "approved"),
    [liveQuestions],
  );

  const filteredPresets = useMemo(
    () =>
      presetKindFilter === "all"
        ? presets
        : presets.filter((preset) => preset.kind === presetKindFilter),
    [presets, presetKindFilter],
  );

  function refresh() {
    router.refresh();
  }

  function run(action: () => Promise<{ ok: boolean; message: string; toolId?: string }>, onOk?: (toolId?: string) => void) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.message);
      else {
        toast.success(result.message);
        onOk?.(result.toolId);
        refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 pb-24 lg:pb-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Audience Interactor</h1>
          <p className="text-sm text-muted-foreground">
            Tap a preset to put it straight on the LED wall.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setBrandOpen((open) => !open)}
          className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-left text-sm"
        >
          <span className="flex size-9 items-center justify-center overflow-hidden rounded-md bg-white ring-1 ring-black/10">
            {settings.brandLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.brandLogoUrl} alt="" className="max-h-8 max-w-8 object-contain" />
            ) : (
              <span className="text-[10px] text-muted-foreground">Logo</span>
            )}
          </span>
          <span>
            <span className="block font-medium">Show branding</span>
            <span className="block text-xs text-muted-foreground">
              {settings.brandLogoUrl ? "Logo set" : "Optional wall logo"}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setCornerOpen((open) => !open)}
          className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-left text-sm"
        >
          <span className="flex size-9 items-center justify-center overflow-hidden rounded-md bg-white ring-1 ring-black/10">
            {settings.cornerSponsor.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.cornerSponsor.imageUrl} alt="" className="max-h-8 max-w-8 object-contain" />
            ) : (
              <span className="text-[10px] text-muted-foreground">Logo</span>
            )}
          </span>
          <span>
            <span className="block font-medium">Corner sponsor</span>
            <span className="block text-xs text-muted-foreground">
              {settings.cornerSponsor.enabled
                ? "On the LED wall"
                : settings.cornerSponsor.name || settings.cornerSponsor.imageUrl
                  ? "Hidden"
                  : "Optional corner logo"}
            </span>
          </span>
        </button>
        </div>
      </header>

      {brandOpen ? (
        <section className="rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex size-20 items-center justify-center overflow-visible rounded-2xl bg-white p-2 shadow-sm ring-1 ring-black/10">
              {settings.brandLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={settings.brandLogoUrl}
                  alt="Podcaster logo"
                  className="max-h-[4.5rem] max-w-[4.5rem] object-contain"
                />
              ) : (
                <span className="px-2 text-center text-xs text-muted-foreground">No logo yet</span>
              )}
            </div>
            <div className="min-w-[12rem] flex-1 space-y-2">
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
                  onClick={() =>
                    run(async () => clearAudienceBrandLogoAction())
                  }
                >
                  Remove logo
                </Button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {cornerOpen ? (
        <CornerSponsorPanel
          key={`${settings.cornerSponsor.name}:${settings.cornerSponsor.phone}:${settings.cornerSponsor.message}:${settings.cornerSponsor.imageUrl ?? ""}:${settings.cornerSponsor.enabled}`}
          settings={settings}
          venueId={venueId}
          supabaseEnv={supabaseEnv}
          missingColumns={missingCornerSponsor}
          missingContactColumns={missingCornerSponsorContact}
          onChanged={refresh}
        />
      ) : null}

      <section className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            {session ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono text-2xl tracking-[0.18em] sm:text-3xl">{session.joinCode}</p>
                  <Badge variant="secondary">{guestCount} guests</Badge>
                  <Badge variant={session.votingOpen ? "default" : "secondary"}>
                    {session.votingOpen ? "Voting open" : "Voting closed"}
                  </Badge>
                  <Badge variant={session.resultsRevealed ? "default" : "secondary"}>
                    {session.resultsRevealed ? "Results up" : "Results hidden"}
                  </Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">{joinUrl}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Starting a session switches the LED wall to FloBama in real time. Build presets anytime — even
                before you go live.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {!session ? (
              <Button type="button" disabled={pending} onClick={() => setConfirmStartOpen(true)}>
                Start session
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => run(async () => clearAudienceWallAction())}
                >
                  Clear wall
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm("End the audience session?")) return;
                    run(async () => endAudienceSessionAction());
                  }}
                >
                  End
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-4">
          <section className="rounded-xl border bg-card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-wide uppercase">Presets</h2>
              <select
                className="h-9 rounded-lg border border-input bg-transparent px-2 text-xs"
                value={presetKindFilter}
                onChange={(event) =>
                  setPresetKindFilter(event.target.value as AudienceToolKind | "all")
                }
                aria-label="Filter presets by game mode"
              >
                <option value="all">All modes</option>
                {AUDIENCE_TOOL_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {AUDIENCE_TOOL_LABELS[kind]}
                  </option>
                ))}
              </select>
            </div>

            {missingPresetsTable ? (
              <p className="text-sm text-amber-800">
                Apply the audience presets migration to save reusable game-mode setups.
              </p>
            ) : filteredPresets.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Save filled-in polls, hot takes, and cards here so you are not typing mid-show.
              </p>
            ) : (
              <ul className="max-h-[40vh] space-y-2 overflow-y-auto pr-1 lg:max-h-[62vh]">
                {filteredPresets.map((preset) => (
                  <li key={preset.id} className="rounded-lg border px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-start gap-2">
                        {preset.kind === "picture" && typeof preset.payload.imageUrl === "string" && preset.payload.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={preset.payload.imageUrl}
                            alt=""
                            className="size-12 shrink-0 rounded-md object-cover ring-1 ring-black/10"
                          />
                        ) : null}
                        <div className="min-w-0">
                          <p className="truncate font-medium">{preset.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {AUDIENCE_TOOL_LABELS[preset.kind]} · {preset.title}
                          </p>
                          {liveTool && liveTool.kind === preset.kind && liveTool.title === preset.title ? (
                            <Badge className="mt-1">On the wall</Badge>
                          ) : null}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => {
                          if (!window.confirm(`Delete preset “${preset.name}”?`)) return;
                          run(async () => deleteAudiencePresetAction({ presetId: preset.id }));
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                    {preset.kind === "sponsor" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-2 w-full"
                        disabled={pending}
                        onClick={() => {
                          const name = String(preset.payload.name ?? preset.title ?? "").trim();
                          const imageUrl = String(preset.payload.imageUrl ?? "").trim();
                          if (!name && !imageUrl) {
                            toast.error("This sponsor preset needs a name or image.");
                            return;
                          }
                          run(async () =>
                            saveAudienceCornerSponsorAction({
                              name,
                              imageUrl: imageUrl || null,
                              enabled: true,
                            }),
                          );
                        }}
                      >
                        Show in corner
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      className="mt-2 w-full"
                      disabled={pending}
                      onClick={() => {
                        if (!session) {
                          setConfirmStartOpen(true);
                          return;
                        }
                        run(async () =>
                          putAudiencePresetOnWallAction({
                            sessionId: session.id,
                            presetId: preset.id,
                          }),
                        );
                      }}
                    >
                      {session ? "Put on LED wall" : "Start session to use"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-xl border bg-card p-4 sm:p-5">
            {!session ? (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Build presets before the show</h2>
                <p className="text-sm text-muted-foreground">
                  Pick a game mode, fill the fields, and save a named preset. It shows up in the list and goes
                  straight to the LED wall.
                </p>
                <PresetBuilder
                  pending={pending}
                  onSaved={refresh}
                  venueId={venueId}
                  supabaseEnv={supabaseEnv}
                />
              </div>
            ) : !liveTool ? (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Nothing on the LED wall</h2>
                <p className="text-sm text-muted-foreground">
                  Choose a preset from the list to put it on the wall.
                </p>
                <PresetBuilder
                  pending={pending}
                  onSaved={refresh}
                  venueId={venueId}
                  supabaseEnv={supabaseEnv}
                />
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-xl font-semibold">
                      {AUDIENCE_TOOL_LABELS[liveTool.kind as AudienceToolKind] ?? liveTool.title}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {AUDIENCE_TOOL_HINTS[liveTool.kind as AudienceToolKind] ?? ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(async () =>
                        putAudienceToolOnWallAction({
                          toolId: liveTool.id,
                          resultsRevealed: false,
                          votingOpen: true,
                        }),
                      )
                    }
                  >
                    Update on wall
                  </Button>
                </div>

                {showRevealControls ? (
                  <div className="mt-4 grid gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
                    <Button
                      type="button"
                      variant={session.votingOpen ? "secondary" : "default"}
                      className="min-h-11"
                      disabled={pending}
                      onClick={() =>
                        run(async () =>
                          setAudienceVotingAction({ votingOpen: !session.votingOpen }),
                        )
                      }
                    >
                      {session.votingOpen ? "Close voting" : "Open voting"}
                    </Button>
                    <Button
                      type="button"
                      variant={session.resultsRevealed ? "secondary" : "default"}
                      className="min-h-11"
                      disabled={pending}
                      onClick={() =>
                        run(async () =>
                          setAudienceRevealAction({
                            resultsRevealed: !session.resultsRevealed,
                          }),
                        )
                      }
                    >
                      {session.resultsRevealed ? "Hide results" : "Reveal results"}
                    </Button>
                  </div>
                ) : null}

                <div className="mt-4">
                  <ToolEditor
                    key={liveTool.id}
                    tool={liveTool}
                    pending={pending}
                    presetName={presetName}
                    onPresetNameChange={setPresetName}
                    venueId={venueId}
                    supabaseEnv={supabaseEnv}
                    onSave={(payload, title) => {
                      run(async () =>
                        updateAudienceToolAction({
                          toolId: liveTool.id,
                          payload,
                          title,
                        }),
                      );
                    }}
                    onShowInCorner={
                      liveTool.kind === "sponsor"
                        ? (payload) => {
                            const name = String(payload.name ?? "").trim();
                            const imageUrl = String(payload.imageUrl ?? "").trim();
                            if (!name && !imageUrl) {
                              toast.error("Add a sponsor name or image first.");
                              return;
                            }
                            run(async () => {
                              const saved = await updateAudienceToolAction({
                                toolId: liveTool.id,
                                payload,
                                title: name || liveTool.title,
                              });
                              if (!saved.ok) return saved;
                              return saveAudienceCornerSponsorAction({
                                name,
                                imageUrl: imageUrl || null,
                                enabled: true,
                              });
                            });
                          }
                        : undefined
                    }
                    onSavePreset={(payload, title) => {
                      const name = presetName.trim();
                      if (!name) {
                        toast.error("Name the preset first.");
                        return;
                      }
                      run(
                        async () =>
                          saveAudiencePresetAction({
                            kind: liveTool.kind as AudienceToolKind,
                            name,
                            title: title ?? liveTool.title,
                            payload,
                          }),
                        () => setPresetName(""),
                      );
                    }}
                  />
                </div>
              </>
            )}
          </section>

          {session && liveTool ? (
            <section className="rounded-xl border bg-card p-4 sm:p-5">
              <h2 className="text-lg font-semibold">New preset</h2>
              <p className="mt-1 mb-3 text-sm text-muted-foreground">
                Save another preset. It joins the list and can go on the wall immediately.
              </p>
              <PresetBuilder
                pending={pending}
                onSaved={refresh}
                venueId={venueId}
                supabaseEnv={supabaseEnv}
              />
            </section>
          ) : null}

          {session ? (
            <section className="rounded-xl border bg-card p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">Audience questions</h2>
                  <p className="text-xs text-muted-foreground">New questions show up here on their own.</p>
                </div>
                <Badge variant="secondary">{pendingQuestions.length} waiting</Badge>
              </div>
              {pendingQuestions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No questions waiting.</p>
              ) : (
                <ul className="max-h-64 space-y-3 overflow-y-auto pr-1">
                  {pendingQuestions.map((q) => (
                    <li key={q.id} className="rounded-lg border px-3 py-3">
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
                            onClick={() =>
                              run(async () =>
                                moderateAudienceQuestionAction({
                                  questionId: q.id,
                                  status,
                                }),
                              )
                            }
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
      </div>

      {session && showRevealControls ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm lg:hidden">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-2">
            <Button
              type="button"
              variant={session.votingOpen ? "secondary" : "default"}
              className="min-h-11"
              disabled={pending}
              onClick={() =>
                run(async () => setAudienceVotingAction({ votingOpen: !session.votingOpen }))
              }
            >
              {session.votingOpen ? "Close voting" : "Open voting"}
            </Button>
            <Button
              type="button"
              variant={session.resultsRevealed ? "secondary" : "default"}
              className="min-h-11"
              disabled={pending}
              onClick={() =>
                run(async () =>
                  setAudienceRevealAction({ resultsRevealed: !session.resultsRevealed }),
                )
              }
            >
              {session.resultsRevealed ? "Hide results" : "Reveal results"}
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={confirmStartOpen} onOpenChange={setConfirmStartOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Start audience session?</DialogTitle>
            <DialogDescription>
              Proceeding switches the LED wall to FloBama in real time. Only start if you are testing, or on stage
              and ready to use Audience Interactor.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setConfirmStartOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() => {
                setConfirmStartOpen(false);
                run(async () => startAudienceSessionAction({ title: "FloBama Live" }));
              }}
            >
              Start session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PresetBuilder({
  pending,
  onSaved,
  venueId,
  supabaseEnv,
}: {
  pending: boolean;
  onSaved: () => void;
  venueId: string;
  supabaseEnv: PublicSupabaseEnv | null;
}) {
  const [kind, setKind] = useState<AudienceToolKind>("picture");
  const [name, setName] = useState("");
  const [draft, setDraft] = useState(() => defaultPayloadForKind("picture"));
  const [, startTransition] = useTransition();

  function changeKind(next: AudienceToolKind) {
    setKind(next);
    setDraft(defaultPayloadForKind(next));
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="offline-kind">Game mode</Label>
          <select
            id="offline-kind"
            className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
            value={kind}
            onChange={(event) => changeKind(event.target.value as AudienceToolKind)}
          >
            {AUDIENCE_TOOL_KINDS.map((value) => (
              <option key={value} value={value}>
                {AUDIENCE_TOOL_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="offline-name">Preset name</Label>
          <Input
            id="offline-name"
            value={name}
            placeholder="e.g. Opening graphic"
            onChange={(event) => setName(event.target.value)}
          />
        </div>
      </div>
      <OfflineFields
        kind={kind}
        draft={draft}
        setDraft={setDraft}
        pending={pending}
        venueId={venueId}
        supabaseEnv={supabaseEnv}
      />
      <Button
        type="button"
        disabled={pending || !name.trim() || (kind === "picture" && !String(draft.imageUrl ?? "").trim())}
        onClick={() => {
          const presetName = name.trim();
          if (!presetName) return;
          if (kind === "picture" && !String(draft.imageUrl ?? "").trim()) {
            toast.error("Upload a picture first.");
            return;
          }
          startTransition(async () => {
            const result = await saveAudiencePresetAction({
              kind,
              name: presetName,
              title: kind === "picture" ? presetName : undefined,
              payload: draft,
            });
            if (!result.ok) toast.error(result.message);
            else {
              toast.success(result.message);
              setName("");
              setDraft(defaultPayloadForKind(kind));
              onSaved();
            }
          });
        }}
      >
        Save preset
      </Button>
    </div>
  );
}

function OfflineFields({
  kind,
  draft,
  setDraft,
  pending,
  venueId,
  supabaseEnv,
}: {
  kind: AudienceToolKind;
  draft: Record<string, unknown>;
  setDraft: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  pending: boolean;
  venueId: string;
  supabaseEnv: PublicSupabaseEnv | null;
}) {
  if (kind === "message") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Message on the wall" value={String(draft.text ?? "")} onChange={(value) => setDraft((prev) => ({ ...prev, text: value }))} />
        <Field label="Smaller line underneath (optional)" value={String(draft.subtitle ?? "")} onChange={(value) => setDraft((prev) => ({ ...prev, subtitle: value }))} />
      </div>
    );
  }
  if (kind === "hot_take") {
    return (
      <Field label="Hot take statement" value={String(draft.statement ?? "")} onChange={(value) => setDraft((prev) => ({ ...prev, statement: value }))} />
    );
  }
  if (kind === "poll") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Question" value={String(draft.prompt ?? "")} onChange={(value) => setDraft((prev) => ({ ...prev, prompt: value }))} />
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
      </div>
    );
  }
  if (kind === "host_picks") {
    const hostA = (draft.hostA ?? {}) as Record<string, unknown>;
    const hostB = (draft.hostB ?? {}) as Record<string, unknown>;
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Question" value={String(draft.prompt ?? "")} onChange={(value) => setDraft((prev) => ({ ...prev, prompt: value }))} />
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
          onChange={(value) => setDraft((prev) => ({ ...prev, hostA: { ...hostA, name: "Austin", pick: value } }))}
        />
        <Field
          label="Hunter’s pick"
          value={String(hostB.pick ?? "")}
          onChange={(value) => setDraft((prev) => ({ ...prev, hostB: { ...hostB, name: "Hunter", pick: value } }))}
        />
      </div>
    );
  }
  if (kind === "questions") {
    return (
      <Field label="Prompt on guest phones" value={String(draft.prompt ?? "")} onChange={(value) => setDraft((prev) => ({ ...prev, prompt: value }))} />
    );
  }
  if (kind === "matchup") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Team A" value={String(draft.teamA ?? "")} onChange={(value) => setDraft((prev) => ({ ...prev, teamA: value }))} />
        <Field label="Team B" value={String(draft.teamB ?? "")} onChange={(value) => setDraft((prev) => ({ ...prev, teamB: value }))} />
        <Field label="Kickoff / when" value={String(draft.kickoff ?? "")} onChange={(value) => setDraft((prev) => ({ ...prev, kickoff: value }))} />
        <Field label="Discussion prompt" value={String(draft.prompt ?? "")} onChange={(value) => setDraft((prev) => ({ ...prev, prompt: value }))} />
      </div>
    );
  }
  if (kind === "sponsor") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Sponsor name" value={String(draft.name ?? "")} onChange={(value) => setDraft((prev) => ({ ...prev, name: value }))} />
        <Field label="Phone number" value={String(draft.phone ?? "")} onChange={(value) => setDraft((prev) => ({ ...prev, phone: value }))} />
        <Field label="Optional message" value={String(draft.blurb ?? "")} onChange={(value) => setDraft((prev) => ({ ...prev, blurb: value }))} />
      </div>
    );
  }
  if (kind === "countdown") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Label on the wall" value={String(draft.label ?? "")} onChange={(value) => setDraft((prev) => ({ ...prev, label: value }))} />
        <Field
          label="Seconds to show (example: 120)"
          value={String(draft.seconds ?? 120)}
          onChange={(value) => setDraft((prev) => ({ ...prev, seconds: Number(value) || 0, endsAt: null }))}
        />
      </div>
    );
  }
  if (kind === "picture") {
    return (
      <PictureFields
        draft={draft}
        setDraft={setDraft}
        pending={pending}
        venueId={venueId}
        supabaseEnv={supabaseEnv}
      />
    );
  }
  return null;
}

function PictureFields({
  draft,
  setDraft,
  pending,
  venueId,
  supabaseEnv,
}: {
  draft: Record<string, unknown>;
  setDraft: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  pending: boolean;
  venueId: string;
  supabaseEnv: PublicSupabaseEnv | null;
}) {
  const [, startTransition] = useTransition();
  const imageUrl = String(draft.imageUrl ?? "");

  return (
    <div className="space-y-3 sm:col-span-2">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex size-36 items-center justify-center overflow-hidden rounded-xl bg-muted ring-1 ring-black/10">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="size-full object-cover" />
          ) : (
            <span className="px-3 text-center text-xs text-muted-foreground">No picture yet</span>
          )}
        </div>
        <div className="min-w-[14rem] flex-1 space-y-2">
          <Label htmlFor="picture-upload">Upload picture (PNG, JPG, or WebP)</Label>
          <Input
            id="picture-upload"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={pending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              startTransition(async () => {
                const result = await uploadAudiencePictureFromBrowser({
                  file,
                  venueId,
                  supabaseEnv,
                });
                if (!result.ok) toast.error(result.message);
                else {
                  toast.success(result.message);
                  setDraft((prev) => ({
                    ...prev,
                    imageUrl: result.publicUrl,
                    storagePath: result.storagePath,
                  }));
                }
              });
            }}
          />
          <p className="text-xs text-muted-foreground">
            Save as a preset so you can put this graphic on the LED wall during the show.
          </p>
        </div>
      </div>
      <Field
        label="Caption on the wall (optional)"
        value={String(draft.caption ?? "")}
        onChange={(value) => setDraft((prev) => ({ ...prev, caption: value }))}
      />
    </div>
  );
}

function ToolEditor({
  tool,
  pending,
  presetName,
  onPresetNameChange,
  venueId,
  supabaseEnv,
  onSave,
  onSavePreset,
  onShowInCorner,
}: {
  tool: StaffAudienceTool;
  pending: boolean;
  presetName: string;
  onPresetNameChange: (value: string) => void;
  venueId: string;
  supabaseEnv: PublicSupabaseEnv | null;
  onSave: (payload: Record<string, unknown>, title?: string) => void;
  onSavePreset: (payload: Record<string, unknown>, title?: string) => void;
  onShowInCorner?: (payload: Record<string, unknown>) => void;
}) {
  const [draft, setDraft] = useState(() => ({ ...tool.payload }));
  const kind = tool.kind as AudienceToolKind;

  function save(title?: string) {
    onSave(draft, title);
  }

  function savePreset(title?: string) {
    onSavePreset(draft, title);
  }

  if (kind === "message") {
    return (
      <EditorShell
        pending={pending}
        onSave={() => save(String(draft.text ?? "Message"))}
        presetName={presetName}
        onPresetNameChange={onPresetNameChange}
        onSavePreset={() => savePreset(String(draft.text ?? "Message"))}
      >
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
      <EditorShell
        pending={pending}
        onSave={() => save()}
        presetName={presetName}
        onPresetNameChange={onPresetNameChange}
        onSavePreset={() => savePreset()}
      >
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
      <EditorShell
        pending={pending}
        onSave={() => save(String(draft.prompt ?? "Poll"))}
        presetName={presetName}
        onPresetNameChange={onPresetNameChange}
        onSavePreset={() => savePreset(String(draft.prompt ?? "Poll"))}
      >
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
      <EditorShell
        pending={pending}
        onSave={() => save(String(draft.prompt ?? "Host picks"))}
        presetName={presetName}
        onPresetNameChange={onPresetNameChange}
        onSavePreset={() => savePreset(String(draft.prompt ?? "Host picks"))}
      >
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
        <div className="flex flex-wrap gap-2 sm:col-span-2">
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
      <EditorShell
        pending={pending}
        onSave={() => save()}
        presetName={presetName}
        onPresetNameChange={onPresetNameChange}
        onSavePreset={() => savePreset()}
      >
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
      <EditorShell
        pending={pending}
        onSave={() => save(`${draft.teamA} vs ${draft.teamB}`)}
        presetName={presetName}
        onPresetNameChange={onPresetNameChange}
        onSavePreset={() => savePreset(`${draft.teamA} vs ${draft.teamB}`)}
      >
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
      <EditorShell
        pending={pending}
        onSave={() => save(String(draft.name ?? "Sponsor"))}
        presetName={presetName}
        onPresetNameChange={onPresetNameChange}
        onSavePreset={() => savePreset(String(draft.name ?? "Sponsor"))}
        extraActions={
          onShowInCorner ? (
            <Button type="button" variant="outline" disabled={pending} onClick={() => onShowInCorner(draft)}>
              Show in corner
            </Button>
          ) : null
        }
      >
        <Field
          label="Sponsor name"
          value={String(draft.name ?? "")}
          onChange={(value) => setDraft((prev) => ({ ...prev, name: value }))}
        />
        <Field
          label="Phone number"
          value={String(draft.phone ?? "")}
          onChange={(value) => setDraft((prev) => ({ ...prev, phone: value }))}
        />
        <Field
          label="Optional message"
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
      <EditorShell
        pending={pending}
        onSave={() => save(String(draft.label ?? "Countdown"))}
        presetName={presetName}
        onPresetNameChange={onPresetNameChange}
        onSavePreset={() => savePreset(String(draft.label ?? "Countdown"))}
      >
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

  if (kind === "picture") {
    const title = String(draft.caption ?? "").trim() || "Picture";
    return (
      <EditorShell
        pending={pending}
        onSave={() => save(title)}
        presetName={presetName}
        onPresetNameChange={onPresetNameChange}
        onSavePreset={() => savePreset(title)}
      >
        <PictureFields
          draft={draft}
          setDraft={setDraft}
          pending={pending}
          venueId={venueId}
          supabaseEnv={supabaseEnv}
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
  presetName,
  onPresetNameChange,
  onSavePreset,
  extraActions,
}: {
  children: React.ReactNode;
  pending: boolean;
  onSave: () => void;
  presetName: string;
  onPresetNameChange: (value: string) => void;
  onSavePreset: () => void;
  extraActions?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" disabled={pending} onClick={onSave}>
          Save changes
        </Button>
        {extraActions}
      </div>
      <div className="flex flex-wrap items-end gap-2 border-t pt-4">
        <div className="min-w-[10rem] flex-1 space-y-1">
          <Label htmlFor="preset-name">Save as preset</Label>
          <Input
            id="preset-name"
            placeholder="e.g. Opening poll"
            value={presetName}
            onChange={(event) => onPresetNameChange(event.target.value)}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={pending || !presetName.trim()}
          onClick={onSavePreset}
        >
          Save preset
        </Button>
      </div>
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
