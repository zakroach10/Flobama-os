"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  advanceGuessPlayerAction,
  pollAudienceGuessAction,
  startGuessLyricRoundAction,
} from "@/actions/audience";
import { ReorderList } from "@/components/audience/reorder-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadAudiencePictureFromBrowser } from "@/lib/audience/picture-upload";
import {
  guessPlayersForEditor,
  type GuessPlayer,
  type StaffGuessRound,
} from "@/lib/audience/guess";
import { AUDIENCE_POLL_MS } from "@/lib/constants";
import type { PublicSupabaseEnv } from "@/lib/env";

export function GuessPlayerFields({
  draft,
  setDraft,
  pending,
  venueId,
  supabaseEnv,
  toolId,
  votingOpen,
  onToggleVoting,
  onPersistOrder,
}: {
  draft: Record<string, unknown>;
  setDraft: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  pending: boolean;
  venueId: string;
  supabaseEnv: PublicSupabaseEnv | null;
  toolId?: string;
  votingOpen?: boolean;
  onToggleVoting?: () => void;
  onPersistOrder?: (players: GuessPlayer[]) => void;
}) {
  const players = guessPlayersForEditor(draft);
  const [round, setRound] = useState<StaffGuessRound | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!toolId) return;
    let cancelled = false;
    async function pull() {
      const result = await pollAudienceGuessAction();
      if (!cancelled && result.ok && result.round?.kind === "guess_player") setRound(result.round);
    }
    void pull();
    const id = window.setInterval(() => void pull(), AUDIENCE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [toolId]);

  function writePlayers(next: GuessPlayer[], activePlayerId?: string, persist = false) {
    setDraft((prev) => ({
      ...prev,
      players: next,
      activePlayerId: activePlayerId ?? prev.activePlayerId,
    }));
    if (persist) onPersistOrder?.(next);
  }

  return (
    <div className="space-y-4 sm:col-span-2">
      <p className="text-sm text-muted-foreground">
        Ten players, in the order the game runs. Drag a row, or use Up and Down. The wall shows the photo
        only. The first guess that matches the name exactly — same spelling, capitalization, and spaces — wins
        that player.
      </p>
      <div className="space-y-1">
        <Label htmlFor="guess-player-prompt">Prompt on the wall</Label>
        <Input
          id="guess-player-prompt"
          value={String(draft.prompt ?? "")}
          onChange={(event) => setDraft((prev) => ({ ...prev, prompt: event.target.value }))}
        />
      </div>
      {toolId ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-3">
          <p className="min-w-[12rem] flex-1 text-sm">
            {round?.status === "won" && round.winner
              ? `${round.winner.displayName} got ${round.winner.answer}.`
              : round
                ? `On the wall: ${round.playerIndex || 1} of ${round.playerCount} · ${round.expected || "unnamed"}`
                : "Save the roster, then put it on the wall."}
          </p>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await advanceGuessPlayerAction({ direction: "prev" });
                if (!result.ok) toast.error(result.message);
                else toast.success(result.message);
              })
            }
          >
            Previous player
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await advanceGuessPlayerAction({ direction: "next" });
                if (!result.ok) toast.error(result.message);
                else toast.success(result.message);
              })
            }
          >
            Next player
          </Button>
          {onToggleVoting ? (
            <Button type="button" variant="outline" disabled={pending} onClick={onToggleVoting}>
              {votingOpen ? "Close guessing" : "Open guessing"}
            </Button>
          ) : null}
        </div>
      ) : null}
      <ReorderList
        items={players}
        getId={(player) => player.id}
        getLabel={(player) => player.name || "player"}
        listLabel="Guess the Player list"
        disabled={pending}
        className="space-y-3"
        onReorder={(next) => writePlayers(next, undefined, true)}
        renderItem={(player, index) => (
          <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[5.5rem_minmax(0,1fr)]">
            <PlayerPhoto
              player={player}
              pending={pending}
              venueId={venueId}
              supabaseEnv={supabaseEnv}
              onUploaded={(photoUrl, storagePath) => {
                const next = players.slice();
                const current = next[index];
                if (!current) return;
                next[index] = { ...current, photoUrl, storagePath };
                writePlayers(next);
              }}
            />
            <div className="space-y-1">
              <Label htmlFor={`player-name-${player.id}`}>Player {index + 1} name</Label>
              <Input
                id={`player-name-${player.id}`}
                value={player.name}
                maxLength={80}
                placeholder="Exact spelling"
                onChange={(event) => {
                  const next = players.slice();
                  const current = next[index];
                  if (!current) return;
                  next[index] = { ...current, name: event.target.value };
                  writePlayers(next);
                }}
              />
            </div>
          </div>
        )}
      />
    </div>
  );
}

function PlayerPhoto({
  player,
  pending,
  venueId,
  supabaseEnv,
  onUploaded,
}: {
  player: GuessPlayer;
  pending: boolean;
  venueId: string;
  supabaseEnv: PublicSupabaseEnv | null;
  onUploaded: (photoUrl: string, storagePath: string) => void;
}) {
  const [, startTransition] = useTransition();
  return (
    <div className="space-y-1">
      <div className="flex size-[5.5rem] items-center justify-center overflow-hidden rounded-lg bg-muted ring-1 ring-black/10">
        {player.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={player.photoUrl} alt="" className="size-full object-cover" />
        ) : (
          <span className="px-1 text-center text-[10px] text-muted-foreground">Photo</span>
        )}
      </div>
      <Input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label={`Upload photo for player ${player.name || "slot"}`}
        disabled={pending}
        className="h-8 text-xs"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          startTransition(async () => {
            const result = await uploadAudiencePictureFromBrowser({
              file,
              venueId,
              supabaseEnv,
              folder: "players",
            });
            if (!result.ok) toast.error(result.message);
            else onUploaded(result.publicUrl, result.storagePath);
          });
        }}
      />
    </div>
  );
}

export function GuessLyricFields({
  draft,
  setDraft,
  pending,
  toolId,
  votingOpen,
  onToggleVoting,
}: {
  draft: Record<string, unknown>;
  setDraft: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  pending: boolean;
  toolId?: string;
  votingOpen?: boolean;
  onToggleVoting?: () => void;
}) {
  const [round, setRound] = useState<StaffGuessRound | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!toolId) return;
    let cancelled = false;
    async function pull() {
      const result = await pollAudienceGuessAction();
      if (!cancelled && result.ok && result.round?.kind === "guess_lyric") setRound(result.round);
    }
    void pull();
    const id = window.setInterval(() => void pull(), AUDIENCE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [toolId]);

  return (
    <div className="space-y-3 sm:col-span-2">
      <p className="text-sm text-muted-foreground">
        The house plays the song. Enter the lyric exactly as the room must type it. End spaces are ignored.
        Capitalization, punctuation, and spaces in the middle count — the same rule as Guess the Player.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="lyric-prompt">Prompt on the wall and phones</Label>
          <Input
            id="lyric-prompt"
            value={String(draft.prompt ?? "")}
            onChange={(event) => setDraft((prev) => ({ ...prev, prompt: event.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="lyric-song">Song title (host only)</Label>
          <Input
            id="lyric-song"
            value={String(draft.songTitle ?? "")}
            onChange={(event) => setDraft((prev) => ({ ...prev, songTitle: event.target.value }))}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="lyric-answer">Correct lyric</Label>
        <Input
          id="lyric-answer"
          value={String(draft.answer ?? "")}
          maxLength={160}
          onChange={(event) => setDraft((prev) => ({ ...prev, answer: event.target.value }))}
          placeholder="The line they have to match"
        />
      </div>
      {toolId ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            disabled={pending || !String(draft.answer ?? "").trim()}
            onClick={() =>
              startTransition(async () => {
                const result = await startGuessLyricRoundAction({
                  toolId,
                  prompt: String(draft.prompt ?? ""),
                  songTitle: String(draft.songTitle ?? ""),
                  answer: String(draft.answer ?? ""),
                });
                if (!result.ok) toast.error(result.message);
                else toast.success(result.message);
              })
            }
          >
            Start round on the wall
          </Button>
          {onToggleVoting ? (
            <Button type="button" variant="outline" disabled={pending} onClick={onToggleVoting}>
              {votingOpen ? "Close guessing" : "Open guessing"}
            </Button>
          ) : null}
          {round?.status === "won" && round.winner ? (
            <p className="text-sm">
              {round.winner.displayName} got it: {round.winner.answer}
            </p>
          ) : round?.status === "playing" ? (
            <p className="text-sm text-muted-foreground">Round is live. Guesses are rising on the wall.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
