"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { endTriviaAction, importTriviaCsvAction, startTriviaAction } from "@/actions/trivia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  TRIVIA_CSV_TEMPLATE,
} from "@/lib/trivia/csv";
import type { TriviaPackSummary, TriviaStaffSession } from "@/lib/trivia/types";
import {
  TRIVIA_DEFAULT_LOBBY_SECONDS,
  TRIVIA_DEFAULT_QUESTION_COUNT,
  TRIVIA_DEFAULT_QUESTION_SECONDS,
} from "@/lib/constants";

export function TriviaPanel({
  packs,
  session,
  missingTable,
  canConfigure,
  joinBaseUrl,
}: {
  packs: TriviaPackSummary[];
  session: TriviaStaffSession | null;
  missingTable: boolean;
  canConfigure: boolean;
  joinBaseUrl: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [packId, setPackId] = useState(packs[0]?.id ?? "");
  const [questionCount, setQuestionCount] = useState(String(TRIVIA_DEFAULT_QUESTION_COUNT));
  const [lobbySeconds, setLobbySeconds] = useState(String(TRIVIA_DEFAULT_LOBBY_SECONDS));
  const [csvText, setCsvText] = useState("");

  if (missingTable) {
    return (
      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Trivia</h2>
        <p className="text-sm text-muted-foreground">
          Apply <code className="text-xs">supabase/migrations/20260929000012_trivia.sql</code> in Supabase, then reload.
        </p>
      </section>
    );
  }

  function start() {
    startTransition(async () => {
      const result = await startTriviaAction({
        packId,
        questionCount: Number.parseInt(questionCount, 10) || TRIVIA_DEFAULT_QUESTION_COUNT,
        lobbySeconds: Number.parseInt(lobbySeconds, 10) || TRIVIA_DEFAULT_LOBBY_SECONDS,
        questionSeconds: TRIVIA_DEFAULT_QUESTION_SECONDS,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  function end() {
    startTransition(async () => {
      const result = await endTriviaAction();
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  function importCsv() {
    startTransition(async () => {
      const result = await importTriviaCsvAction({
        packId,
        csvText,
        replace: true,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      setCsvText("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div>
          <h2 className="text-lg font-semibold">Trivia</h2>
          <p className="text-sm text-muted-foreground">
            Activate an automatic Shoals music history game. LED wall shows QR join, rounds, top 3 teases, and the final board. Vertical kiosks hold a join promo while live.
          </p>
        </div>

        {session ? (
          <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
            <p className="text-sm font-medium">
              Live · {session.packTitle} · {session.status} · Q{session.currentQuestionIndex + 1}/
              {session.questionCount}
            </p>
            <p className="text-sm text-muted-foreground">
              Code <span className="font-semibold text-foreground">{session.joinCode}</span> · {session.playerCount}{" "}
              players · {joinBaseUrl}/{session.joinCode}
            </p>
            <Button type="button" variant="destructive" disabled={pending} onClick={end}>
              End trivia
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="trivia-pack">Question pack</Label>
              <select
                id="trivia-pack"
                className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={packId}
                onChange={(event) => setPackId(event.target.value)}
              >
                {packs.map((pack) => (
                  <option key={pack.id} value={pack.id}>
                    {pack.title} ({pack.questionCount} questions)
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="trivia-count">Questions</Label>
              <Input
                id="trivia-count"
                type="number"
                min={1}
                max={50}
                value={questionCount}
                onChange={(event) => setQuestionCount(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trivia-lobby">Lobby seconds</Label>
              <Input
                id="trivia-lobby"
                type="number"
                min={15}
                max={600}
                value={lobbySeconds}
                onChange={(event) => setLobbySeconds(event.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="button" disabled={pending || !packId || packs.length === 0} onClick={start}>
                {pending ? "Starting…" : "Start trivia"}
              </Button>
            </div>
          </div>
        )}
      </section>

      {canConfigure ? (
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div>
            <h3 className="text-base font-semibold">Upload spreadsheet</h3>
            <p className="text-sm text-muted-foreground">
              CSV headers: <code className="text-xs">question,a,b,c,d,correct,points</code>. Correct is A–D. Replaces the
              selected pack.
            </p>
          </div>
          <textarea
            className="min-h-40 w-full rounded-md border bg-background p-3 font-mono text-xs"
            value={csvText}
            onChange={(event) => setCsvText(event.target.value)}
            placeholder={TRIVIA_CSV_TEMPLATE}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={pending || !csvText.trim() || !packId} onClick={importCsv}>
              Import CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCsvText(TRIVIA_CSV_TEMPLATE);
              }}
            >
              Load template
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
