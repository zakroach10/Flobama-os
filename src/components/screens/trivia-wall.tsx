"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import QRCode from "qrcode";
import { TRIVIA_POLL_MS } from "@/lib/constants";
import { triviaAccentRgba, triviaBrandCssVars } from "@/lib/trivia/brand";
import type { TriviaWallState } from "@/lib/trivia/types";
import { JoinPopups } from "@/components/screens/join-popups";

function remainingLabel(phaseEndsAt: string | null, serverNow: string) {
  if (!phaseEndsAt) return "";
  const skew = Date.now() - Date.parse(serverNow);
  const remaining = Math.max(0, Math.ceil((Date.parse(phaseEndsAt) - (Date.now() - skew)) / 1000));
  return `${remaining}s`;
}

export function TriviaWall({
  initial,
  lockDemo = false,
}: {
  initial: TriviaWallState | null;
  lockDemo?: boolean;
}) {
  const [wall, setWall] = useState<TriviaWallState | null>(initial);
  const [qr, setQr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (lockDemo) {
      const clock = window.setInterval(() => setTick((value) => value + 1), 250);
      return () => window.clearInterval(clock);
    }
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
  }, [lockDemo]);

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

  const brand = wall?.brand;

  useEffect(() => {
    if (!joinUrl || !brand) return;
    let cancelled = false;
    void QRCode.toDataURL(joinUrl, {
      margin: 1,
      width: 520,
      color: { dark: brand.background, light: brand.text },
    }).then((src) => {
      if (!cancelled) setQr(src);
    });
    return () => {
      cancelled = true;
    };
  }, [joinUrl, brand]);

  const qrSrc = joinUrl ? qr : null;

  if (!wall) return null;

  const timer = remainingLabel(wall.phaseEndsAt, wall.serverNow);
  void tick;
  const wash = triviaAccentRgba(wall.brand.accent, 0.28);
  const softWash = triviaAccentRgba(wall.brand.text, 0.12);

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-[var(--trivia-bg)] text-[var(--trivia-text)]"
      style={triviaBrandCssVars(wall.brand) as CSSProperties}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at 20% 20%,${wash},transparent 42%),radial-gradient(circle at 80% 0%,${softWash},transparent 35%),linear-gradient(160deg,color-mix(in srgb,var(--trivia-bg) 85%,white) 0%,var(--trivia-bg) 55%,color-mix(in srgb,var(--trivia-bg) 70%,black) 100%)`,
        }}
      />
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-12 py-6">
        {wall.status === "lobby" ? (
          <LobbyFrame joinCode={wall.joinCode} joinUrl={joinUrl} qr={qrSrc} logoUrl={wall.brand.logoUrl} />
        ) : null}
        {wall.status === "question" || wall.status === "reveal" ? (
          <QuestionFrame wall={wall} reveal={wall.status === "reveal"} />
        ) : null}
        {wall.status === "podium" ? <PodiumFrame wall={wall} tease /> : null}
        {wall.status === "final" ? <PodiumFrame wall={wall} tease={false} /> : null}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between px-10 pt-8">
        <div className="flex items-start gap-5">
          {wall.brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={wall.brand.logoUrl}
              alt=""
              className="mt-1 h-16 w-auto max-w-[180px] object-contain"
            />
          ) : null}
          <div>
            <p className="text-sm font-semibold tracking-[0.28em] text-[var(--trivia-accent)] uppercase">
              Live Trivia
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">{wall.packTitle}</h1>
            <p className="mt-1 text-lg text-[var(--trivia-muted)]">{wall.packTheme}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 px-5 py-3 text-right backdrop-blur-sm">
          <p className="text-xs tracking-[0.2em] text-[var(--trivia-muted-strong)] uppercase">Players</p>
          <p className="text-3xl font-black tabular-nums">{wall.playerCount}</p>
          {timer ? <p className="mt-1 text-sm text-[var(--trivia-accent)] tabular-nums">{timer}</p> : null}
        </div>
      </div>
      <JoinPopups joins={wall.recentJoins} />
    </div>
  );
}

function LobbyFrame({
  joinCode,
  joinUrl,
  qr,
  logoUrl,
}: {
  joinCode: string;
  joinUrl: string | null;
  qr: string | null;
  logoUrl: string | null;
}) {
  return (
    <div className="grid w-full max-w-6xl animate-in fade-in zoom-in-95 grid-cols-1 items-center gap-10 duration-500 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="mb-6 h-20 w-auto max-w-[240px] object-contain" />
        ) : null}
        <p className="text-2xl font-semibold text-[var(--trivia-muted)]">Scan to join · create a temp game name</p>
        <p className="mt-6 text-7xl font-black tracking-[0.18em] text-[var(--trivia-text)]">{joinCode}</p>
        <p className="mt-4 break-all text-xl text-[var(--trivia-muted-strong)]">{joinUrl}</p>
      </div>
      <div className="mx-auto flex aspect-square w-full max-w-[420px] items-center justify-center rounded-[2rem] bg-[var(--trivia-text)] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="Join trivia QR code" className="h-full w-full object-contain" />
        ) : (
          <div className="h-2/3 w-2/3 animate-pulse rounded-xl bg-[color-mix(in_srgb,var(--trivia-muted)_55%,white)]" />
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
    <div className="mx-auto w-full max-w-6xl animate-in fade-in slide-in-from-bottom-4 text-center duration-500">
      <p className="text-sm font-semibold tracking-[0.24em] text-[var(--trivia-accent)] uppercase">
        Question {question.index + 1} / {wall.questionCount}
      </p>
      <h2 className="mx-auto mt-4 max-w-5xl text-4xl font-black leading-tight sm:text-6xl">{question.prompt}</h2>
      <div className="mt-10 grid gap-4 text-left sm:grid-cols-2">
        {question.choices.map((choice, index) => {
          const isCorrect = reveal && question.correctIndex === index;
          const isWrong = reveal && question.correctIndex !== index;
          return (
            <div
              key={`${question.index}-${index}`}
              className={`rounded-2xl border px-6 py-5 text-2xl font-semibold transition-colors duration-300 ${
                isCorrect
                  ? "border-[var(--trivia-accent)] bg-[var(--trivia-accent)] text-[var(--trivia-bg)]"
                  : isWrong
                    ? "border-white/10 bg-black/20 text-[var(--trivia-muted-strong)]"
                    : "border-white/10 bg-black/25 text-[var(--trivia-text)]"
              }`}
            >
              <span className="mr-3 text-[var(--trivia-accent)]">{letters[index]}</span>
              {choice}
            </div>
          );
        })}
      </div>
      {reveal ? (
        <p className="mt-8 text-center text-2xl font-bold text-[var(--trivia-accent)]">Correct answer highlighted</p>
      ) : null}
    </div>
  );
}

function PodiumFrame({ wall, tease }: { wall: TriviaWallState; tease: boolean }) {
  const rows = tease ? wall.top3 : wall.leaderboard.slice(0, 10);
  return (
    <div className="mx-auto w-full max-w-4xl animate-in fade-in zoom-in-95 text-center duration-500">
      <p className="text-sm font-semibold tracking-[0.24em] text-[var(--trivia-accent)] uppercase">
        {tease ? "Top 3 this round" : "Grand leaderboard"}
      </p>
      <h2 className="mt-3 text-5xl font-black">{tease ? "Standing" : "Final scores"}</h2>
      <ol className="mt-10 space-y-4 text-left">
        {rows.length === 0 ? (
          <li className="text-2xl text-[var(--trivia-muted-strong)]">Waiting for scores…</li>
        ) : (
          rows.map((entry) => (
            <li
              key={entry.playerId}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-6 py-5"
            >
              <div className="flex items-center gap-5">
                <span className="w-12 text-3xl font-black text-[var(--trivia-accent)]">#{entry.rank}</span>
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
