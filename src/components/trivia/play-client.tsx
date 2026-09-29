"use client";

import { useEffect, useState, useTransition } from "react";
import { TRIVIA_POLL_MS } from "@/lib/constants";
import type { TriviaPlayerState } from "@/lib/trivia/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TriviaPlayClient({ joinCode }: { joinCode: string }) {
  const [name, setName] = useState("");
  const [player, setPlayer] = useState<TriviaPlayerState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const response = await fetch("/api/public/v1/trivia/me", { cache: "no-store" });
        const json = (await response.json()) as { player?: TriviaPlayerState | null };
        if (!cancelled) setPlayer(json.player ?? null);
      } catch {
        // keep
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), TRIVIA_POLL_MS);
    const clock = window.setInterval(() => setNowMs(Date.now()), 250);
    const immediate = window.setTimeout(() => setNowMs(Date.now()), 0);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearInterval(clock);
      window.clearTimeout(immediate);
    };
  }, []);

  function join() {
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/public/v1/trivia/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinCode, displayName: name }),
      });
      const json = (await response.json()) as { ok?: boolean; error?: string };
      if (!json.ok) {
        setError(json.error ?? "Could not join.");
        return;
      }
      const me = await fetch("/api/public/v1/trivia/me", { cache: "no-store" });
      const meJson = (await me.json()) as { player?: TriviaPlayerState | null };
      setPlayer(meJson.player ?? null);
    });
  }

  function answer(choiceIndex: number) {
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/public/v1/trivia/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choiceIndex }),
      });
      const json = (await response.json()) as { ok?: boolean; error?: string };
      if (!json.ok) {
        setError(json.error ?? "Could not lock answer.");
        return;
      }
      const me = await fetch("/api/public/v1/trivia/me", { cache: "no-store" });
      const meJson = (await me.json()) as { player?: TriviaPlayerState | null };
      setPlayer(meJson.player ?? null);
    });
  }

  if (!player) {
    return (
      <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 px-5 py-10 text-[#f7f1ea]">
        <div>
          <p className="text-xs font-semibold tracking-[0.24em] text-[#d36b4a] uppercase">FloBama Trivia</p>
          <h1 className="mt-2 text-3xl font-black">Join the game</h1>
          <p className="mt-2 text-[#cbb7a8]">Code {joinCode.toUpperCase()} · pick a temp name</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="trivia-name" className="text-[#cbb7a8]">
            Display name
          </Label>
          <Input
            id="trivia-name"
            value={name}
            maxLength={24}
            onChange={(event) => setName(event.target.value)}
            placeholder="Stage name"
            className="h-12 border-white/15 bg-black/30 text-base text-[#f7f1ea]"
          />
        </div>
        {error ? <p className="text-sm text-[#d36b4a]">{error}</p> : null}
        <Button
          type="button"
          disabled={pending || name.trim().length < 1}
          onClick={join}
          className="h-12 bg-[#d36b4a] text-[#1b1612] hover:bg-[#e08a6d]"
        >
          {pending ? "Joining…" : "Join trivia"}
        </Button>
      </div>
    );
  }

  const letters = ["A", "B", "C", "D"] as const;
  const remaining =
    player.phaseEndsAt != null && nowMs != null
      ? Math.max(0, Math.ceil((Date.parse(player.phaseEndsAt) - nowMs) / 1000))
      : null;

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col gap-6 px-5 py-8 text-[#f7f1ea]">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.24em] text-[#d36b4a] uppercase">Playing as</p>
          <h1 className="text-2xl font-black">{player.displayName}</h1>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-right">
          <p className="text-[10px] tracking-[0.18em] text-[#8a7368] uppercase">Score</p>
          <p className="text-xl font-black tabular-nums">{player.score}</p>
          {player.rank ? <p className="text-xs text-[#d36b4a]">#{player.rank}</p> : null}
        </div>
      </header>

      {player.status === "lobby" ? (
        <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
          <p className="text-lg font-semibold">You&apos;re in. Hang tight for question 1.</p>
          {remaining != null ? <p className="mt-2 text-[#cbb7a8]">Starts in {remaining}s</p> : null}
        </div>
      ) : null}

      {(player.status === "question" || player.status === "reveal") && player.question ? (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-[#d36b4a] uppercase">
              Q{player.question.index + 1} / {player.questionCount}
              {remaining != null ? ` · ${remaining}s` : ""}
            </p>
            <h2 className="mt-2 text-xl font-bold leading-snug">{player.question.prompt}</h2>
          </div>
          <div className="grid gap-3">
            {player.question.choices.map((choice, index) => {
              const selected = player.myChoiceIndex === index;
              const correct = player.status === "reveal" && player.question?.correctIndex === index;
              const disabled = pending || player.status !== "question" || player.answered;
              return (
                <button
                  key={`${player.question!.index}-${index}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => answer(index)}
                  className={`rounded-xl border px-4 py-4 text-left text-base font-semibold transition ${
                    correct
                      ? "border-[#d36b4a] bg-[#d36b4a] text-[#1b1612]"
                      : selected
                        ? "border-[#d36b4a] bg-[#d36b4a]/20 text-[#f7f1ea]"
                        : "border-white/10 bg-black/30 text-[#f7f1ea]"
                  } disabled:opacity-80`}
                >
                  <span className="mr-2 text-[#d36b4a]">{letters[index]}</span>
                  {choice}
                </button>
              );
            })}
          </div>
          {player.answered && player.status === "question" ? (
            <p className="text-sm text-[#cbb7a8]">Answer locked. Wait for the reveal.</p>
          ) : null}
          {player.status === "reveal" && player.lastAward != null ? (
            <p className="text-sm font-semibold text-[#d36b4a]">
              {player.lastAward > 0 ? `+${player.lastAward} points` : "No points this round"}
            </p>
          ) : null}
        </div>
      ) : null}

      {player.status === "podium" || player.status === "final" ? (
        <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
          <p className="text-lg font-semibold">
            {player.status === "final" ? "Final board is on the wall." : "Top 3 tease on the wall."}
          </p>
          <p className="mt-2 text-[#cbb7a8]">
            You&apos;re #{player.rank ?? "—"} with {player.score} points.
          </p>
        </div>
      ) : null}

      {error ? <p className="text-sm text-[#d36b4a]">{error}</p> : null}
    </div>
  );
}
