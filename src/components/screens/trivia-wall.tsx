"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { TRIVIA_POLL_MS } from "@/lib/constants";
import type { TriviaWallState } from "@/lib/trivia/types";

function remainingLabel(phaseEndsAt: string | null, serverNow: string) {
  if (!phaseEndsAt) return "";
  const skew = Date.now() - Date.parse(serverNow);
  const remaining = Math.max(0, Math.ceil((Date.parse(phaseEndsAt) - (Date.now() - skew)) / 1000));
  return `${remaining}s`;
}

export function TriviaWall({ initial }: { initial: TriviaWallState | null }) {
  const [wall, setWall] = useState<TriviaWallState | null>(initial);
  const [qr, setQr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const response = await fetch("/api/public/v1/trivia/wall", { cache: "no-store" });
        const json = (await response.json()) as { trivia?: TriviaWallState | null };
        if (!cancelled) setWall(json.trivia ?? null);
      } catch {
        // keep current frame
      }
    }
    const timer = window.setInterval(() => void refresh(), TRIVIA_POLL_MS);
    const clock = window.setInterval(() => setTick((value) => value + 1), 250);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearInterval(clock);
    };
  }, []);

  const joinUrl = useMemo(() => {
    if (!wall) return null;
    if (typeof window === "undefined") return wall.joinPath;
    try {
      if (wall.joinPath.startsWith("http")) return wall.joinPath;
      return new URL(wall.joinPath, window.location.origin).toString();
    } catch {
      return wall.joinPath;
    }
  }, [wall]);

  useEffect(() => {
    if (!joinUrl) return;
    let cancelled = false;
    void QRCode.toDataURL(joinUrl, { margin: 1, width: 520, color: { dark: "#1b1612", light: "#f7f1ea" } }).then(
      (src) => {
        if (!cancelled) setQr(src);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [joinUrl]);

  const qrSrc = joinUrl ? qr : null;

  if (!wall) return null;

  const timer = remainingLabel(wall.phaseEndsAt, wall.serverNow);
  void tick;

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#1b1612] text-[#f7f1ea]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(211,107,74,0.28),transparent_42%),radial-gradient(circle_at_80%_0%,rgba(244,235,227,0.12),transparent_35%),linear-gradient(160deg,#241c17_0%,#1b1612_55%,#120e0c_100%)]" />
      <div className="relative z-10 flex items-center justify-between px-10 pt-8">
        <div>
          <p className="text-sm font-semibold tracking-[0.28em] text-[#d36b4a] uppercase">FloBama Trivia</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">{wall.packTitle}</h1>
          <p className="mt-1 text-lg text-[#cbb7a8]">{wall.packTheme}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 px-5 py-3 text-right backdrop-blur-sm">
          <p className="text-xs tracking-[0.2em] text-[#8a7368] uppercase">Players</p>
          <p className="text-3xl font-black tabular-nums">{wall.playerCount}</p>
          {timer ? <p className="mt-1 text-sm text-[#d36b4a] tabular-nums">{timer}</p> : null}
        </div>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-10 pb-10">
        {wall.status === "lobby" ? <LobbyFrame joinCode={wall.joinCode} joinUrl={joinUrl} qr={qrSrc} /> : null}
        {wall.status === "question" || wall.status === "reveal" ? (
          <QuestionFrame wall={wall} reveal={wall.status === "reveal"} />
        ) : null}
        {wall.status === "podium" ? <PodiumFrame wall={wall} tease /> : null}
        {wall.status === "final" ? <PodiumFrame wall={wall} tease={false} /> : null}
      </div>
    </div>
  );
}

function LobbyFrame({
  joinCode,
  joinUrl,
  qr,
}: {
  joinCode: string;
  joinUrl: string | null;
  qr: string | null;
}) {
  return (
    <div className="grid w-full max-w-6xl animate-in fade-in zoom-in-95 grid-cols-1 items-center gap-10 duration-500 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        <p className="text-2xl font-semibold text-[#cbb7a8]">Scan to join · create a temp game name</p>
        <p className="mt-6 text-7xl font-black tracking-[0.18em] text-[#f7f1ea]">{joinCode}</p>
        <p className="mt-4 break-all text-xl text-[#8a7368]">{joinUrl}</p>
      </div>
      <div className="mx-auto flex aspect-square w-full max-w-[420px] items-center justify-center rounded-[2rem] bg-[#f7f1ea] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="Join trivia QR code" className="h-full w-full object-contain" />
        ) : (
          <div className="h-2/3 w-2/3 animate-pulse rounded-xl bg-[#ddd2c6]" />
        )}
      </div>
    </div>
  );
}

function QuestionFrame({ wall, reveal }: { wall: TriviaWallState; reveal: boolean }) {
  const question = wall.question;
  if (!question) return null;
  const letters = ["A", "B", "C", "D"] as const;
  return (
    <div className="w-full max-w-6xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <p className="text-sm font-semibold tracking-[0.24em] text-[#d36b4a] uppercase">
        Question {question.index + 1} / {wall.questionCount}
      </p>
      <h2 className="mt-4 max-w-5xl text-4xl font-black leading-tight sm:text-5xl">{question.prompt}</h2>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {question.choices.map((choice, index) => {
          const isCorrect = reveal && question.correctIndex === index;
          const isWrong = reveal && question.correctIndex !== index;
          return (
            <div
              key={`${question.index}-${index}`}
              className={`rounded-2xl border px-6 py-5 text-2xl font-semibold transition-colors duration-300 ${
                isCorrect
                  ? "border-[#d36b4a] bg-[#d36b4a] text-[#1b1612]"
                  : isWrong
                    ? "border-white/10 bg-black/20 text-[#8a7368]"
                    : "border-white/10 bg-black/25 text-[#f7f1ea]"
              }`}
            >
              <span className="mr-3 text-[#d36b4a]">{letters[index]}</span>
              {choice}
            </div>
          );
        })}
      </div>
      {reveal ? <p className="mt-8 text-2xl font-bold text-[#d36b4a]">Correct answer highlighted</p> : null}
    </div>
  );
}

function PodiumFrame({ wall, tease }: { wall: TriviaWallState; tease: boolean }) {
  const rows = tease ? wall.top3 : wall.leaderboard.slice(0, 10);
  return (
    <div className="w-full max-w-4xl animate-in fade-in zoom-in-95 duration-500">
      <p className="text-sm font-semibold tracking-[0.24em] text-[#d36b4a] uppercase">
        {tease ? "Top 3 this round" : "Grand leaderboard"}
      </p>
      <h2 className="mt-3 text-5xl font-black">{tease ? "Standing" : "Final scores"}</h2>
      <ol className="mt-10 space-y-4">
        {rows.length === 0 ? (
          <li className="text-2xl text-[#8a7368]">Waiting for scores…</li>
        ) : (
          rows.map((entry) => (
            <li
              key={entry.playerId}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-6 py-5"
            >
              <div className="flex items-center gap-5">
                <span className="w-12 text-3xl font-black text-[#d36b4a]">#{entry.rank}</span>
                <span className="text-3xl font-bold">{entry.displayName}</span>
              </div>
              <span className="text-3xl font-black tabular-nums">{entry.score}</span>
            </li>
          ))
        )}
      </ol>
    </div>
  );
}
