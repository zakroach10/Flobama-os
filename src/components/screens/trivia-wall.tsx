"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import QRCode from "qrcode";
import { FlobamaLogo } from "@/components/brand/flobama-logo";
import { JoinPopups } from "@/components/screens/join-popups";
import { TRIVIA_POLL_MS } from "@/lib/constants";
import { triviaDisplayFont } from "@/lib/trivia/display-font";
import { triviaAccentRgba, triviaBrandCssVars } from "@/lib/trivia/brand";
import type { TriviaWallState } from "@/lib/trivia/types";

function remainingLabel(phaseEndsAt: string | null, serverNow: string) {
  if (!phaseEndsAt) return "";
  const skew = Date.now() - Date.parse(serverNow);
  const remaining = Math.max(0, Math.ceil((Date.parse(phaseEndsAt) - (Date.now() - skew)) / 1000));
  return `${remaining}s`;
}

function shortJoinParts(joinUrl: string | null) {
  if (!joinUrl) return { host: "", path: "" };
  try {
    const url = new URL(joinUrl);
    return { host: url.host, path: url.pathname };
  } catch {
    return { host: joinUrl.replace(/^https?:\/\//, ""), path: "" };
  }
}

export function TriviaWall({
  initial,
  lockDemo = false,
  pollPath = "/api/public/v1/trivia/wall",
  empty = null,
}: {
  initial: TriviaWallState | null;
  lockDemo?: boolean;
  /** Same-origin poll URL. The share page passes a token-scoped path. */
  pollPath?: string;
  /** Shown only while no game is on the wall. The in-app LED display leaves this unset. */
  empty?: ReactNode;
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
        const response = await fetch(pollPath, { cache: "no-store" });
        if (!response.ok) return;
        const json = (await response.json()) as { trivia?: TriviaWallState | null };
        if (!cancelled) setWall(json.trivia ?? null);
      } catch {
        // keep current frame
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), TRIVIA_POLL_MS);
    const clock = window.setInterval(() => setTick((value) => value + 1), 250);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearInterval(clock);
    };
  }, [lockDemo, pollPath]);

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
      margin: 2,
      width: 900,
      errorCorrectionLevel: "H",
      color: { dark: brand.background, light: brand.text },
    }).then((src) => {
      if (!cancelled) setQr(src);
    });
    return () => {
      cancelled = true;
    };
  }, [joinUrl, brand]);

  const qrSrc = joinUrl ? qr : null;
  const timer = wall ? remainingLabel(wall.phaseEndsAt, wall.serverNow) : "";
  void tick;

  return (
    // Fill the browser viewport in normal flow. A fixed 1920×1080 box positioned
    // at 50%/50% and recentered with a transform is clipped to the lower-right in
    // OBS 32 when that browser drops the transform value.
    <div className={`${triviaDisplayFont.className} relative h-full w-full overflow-hidden`} style={{ fontSynthesis: "none" }}>
      {wall ? <LiveTrivia wall={wall} qr={qrSrc} joinUrl={joinUrl} timer={timer} /> : empty}
    </div>
  );
}

function LiveTrivia({
  wall,
  qr,
  joinUrl,
  timer,
}: {
  wall: TriviaWallState;
  qr: string | null;
  joinUrl: string | null;
  timer: string;
}) {
  const wash = triviaAccentRgba(wall.brand.accent, 0.34);
  const softWash = triviaAccentRgba(wall.brand.text, 0.14);
  const playing =
    wall.playerCount === 0 ? "Be the first to join" : `${wall.playerCount} playing`;

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-[var(--trivia-bg)] text-[var(--trivia-text)]"
      style={triviaBrandCssVars(wall.brand) as CSSProperties}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at 12% 0%,${wash},transparent 46%),radial-gradient(circle at 88% 100%,${softWash},transparent 38%),linear-gradient(165deg,color-mix(in srgb,var(--trivia-bg) 78%,white) 0%,var(--trivia-bg) 48%,color-mix(in srgb,var(--trivia-bg) 62%,black) 100%)`,
        }}
      />
      {wall.status === "lobby" ? (
        <LobbyFrame wall={wall} joinUrl={joinUrl} qr={qr} playing={playing} timer={timer} />
      ) : null}
      {wall.status === "question" || wall.status === "reveal" ? (
        <QuestionStage
          wall={wall}
          joinUrl={joinUrl}
          qr={qr}
          playing={playing}
          timer={timer}
          reveal={wall.status === "reveal"}
        />
      ) : null}
      {wall.status === "podium" || wall.status === "final" ? (
        <PodiumStage
          wall={wall}
          joinUrl={joinUrl}
          qr={qr}
          playing={playing}
          tease={wall.status === "podium"}
        />
      ) : null}
      <JoinPopups joins={wall.recentJoins} className="top-7 left-12 justify-start" />
    </div>
  );
}

function LobbyFrame({
  wall,
  joinUrl,
  qr,
  playing,
  timer,
}: {
  wall: TriviaWallState;
  joinUrl: string | null;
  qr: string | null;
  playing: string;
  timer: string;
}) {
  const logo = wall.brand.logoUrl;
  return (
    <div className="relative z-10 flex h-full items-center px-16 py-12 pr-[360px]">
      <div className="min-w-0">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="h-[220px] w-auto max-w-[720px] object-contain object-left" />
        ) : (
          <FlobamaLogo className="h-[120px] w-auto" priority />
        )}
        <p className="mt-5 text-[20px] tracking-[0.28em] text-[var(--trivia-accent)] uppercase">Live trivia</p>
        <h1 className={`max-w-[1100px] leading-[0.92] ${logo ? "mt-2 text-[72px]" : "mt-3 text-[104px]"}`}>
          {wall.packTitle}
        </h1>
        <p className="mt-2 text-[28px] text-[var(--trivia-muted)]">{wall.packTheme}</p>
        <p className="mt-6 text-[56px] leading-none text-[var(--trivia-accent)]">Come play.</p>
        <p className="mt-3 text-[28px]">Scan the code and pick a game name.</p>
        <p className="mt-5 text-[18px] tracking-[0.22em] text-[var(--trivia-muted-strong)] uppercase">
          {playing}
          {timer ? ` · ${timer}` : ""}
        </p>
      </div>
      <CornerJoin qr={qr} joinUrl={joinUrl} code={wall.joinCode} hint="Point your camera here" />
    </div>
  );
}

function QuestionStage({
  wall,
  joinUrl,
  qr,
  playing,
  timer,
  reveal,
}: {
  wall: TriviaWallState;
  joinUrl: string | null;
  qr: string | null;
  playing: string;
  timer: string;
  reveal: boolean;
}) {
  return (
    <div className="relative z-10 flex h-full flex-col px-14 pt-8 pb-16 pr-[340px]">
      <BrandHeader wall={wall} playing={playing} timer={timer} />
      <div className="flex min-h-0 flex-1 flex-col justify-center pt-6">
        <QuestionFrame wall={wall} reveal={reveal} />
      </div>
      <CornerJoin qr={qr} joinUrl={joinUrl} code={wall.joinCode} hint="Jump in anytime" />
    </div>
  );
}

function BrandHeader({
  wall,
  playing,
  timer,
}: {
  wall: TriviaWallState;
  playing: string;
  timer: string;
}) {
  return (
    <div className="flex items-center justify-between gap-8">
      <div className="flex min-w-0 items-center gap-6">
        {wall.brand.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={wall.brand.logoUrl}
            alt=""
            className="h-[132px] w-auto max-w-[420px] object-contain object-left"
          />
        ) : (
          <FlobamaLogo className="h-[96px] w-auto" priority />
        )}
        <div className="min-w-0">
          <p className="text-[18px] tracking-[0.24em] text-[var(--trivia-accent)] uppercase">Live trivia</p>
          <p className="truncate text-[48px] leading-none">{wall.packTitle}</p>
          <p className="mt-1 text-[20px] text-[var(--trivia-muted)]">{playing}</p>
        </div>
      </div>
      <div className="shrink-0 rounded-3xl border border-white/15 bg-black/35 px-6 py-3 text-right">
        <p className="text-[14px] tracking-[0.2em] text-[var(--trivia-muted-strong)] uppercase">Players</p>
        <p className="text-[36px] leading-none tabular-nums">{wall.playerCount}</p>
        {timer ? <p className="mt-1 text-[40px] leading-none text-[var(--trivia-accent)] tabular-nums">{timer}</p> : null}
      </div>
    </div>
  );
}

function QuestionFrame({ wall, reveal }: { wall: TriviaWallState; reveal: boolean }) {
  const question = wall.question;
  if (!question) return null;
  const letters = ["A", "B", "C", "D"] as const;
  return (
    <div className="flex min-h-0 flex-col justify-center">
      <p className="text-[22px] tracking-[0.22em] text-[var(--trivia-accent)] uppercase">
        Question {question.index + 1} / {wall.questionCount}
      </p>
      <h2 className="mt-3 max-w-[1280px] text-[58px] leading-[1.05]">{question.prompt}</h2>
      <div className="mt-8 grid grid-cols-2 gap-4">
        {question.choices.map((choice, index) => {
          const isCorrect = reveal && question.correctIndex === index;
          const isWrong = reveal && question.correctIndex !== index;
          return (
            <div
              key={`${question.index}-${index}`}
              className={`rounded-2xl border px-6 py-5 text-[34px] leading-tight ${
                isCorrect
                  ? "border-[var(--trivia-accent)] bg-[var(--trivia-accent)] text-[var(--trivia-bg)]"
                  : isWrong
                    ? "border-white/10 bg-black/20 text-[var(--trivia-muted-strong)]"
                    : "border-white/15 bg-black/30 text-[var(--trivia-text)]"
              }`}
            >
              <span className={`mr-4 ${isCorrect ? "text-[var(--trivia-bg)]" : "text-[var(--trivia-accent)]"}`}>
                {letters[index]}
              </span>
              {choice}
            </div>
          );
        })}
      </div>
      {reveal ? (
        <p className="mt-5 text-[28px] text-[var(--trivia-accent)]">Correct answer highlighted</p>
      ) : null}
    </div>
  );
}

function PodiumStage({
  wall,
  joinUrl,
  qr,
  playing,
  tease,
}: {
  wall: TriviaWallState;
  joinUrl: string | null;
  qr: string | null;
  playing: string;
  tease: boolean;
}) {
  const rows = tease ? wall.top3 : wall.leaderboard.slice(0, 6);
  return (
    <div className="relative z-10 flex h-full flex-col justify-center px-16 py-12 pr-[340px]">
      <div className="flex items-center gap-6">
        {wall.brand.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={wall.brand.logoUrl} alt="" className="h-[120px] w-auto max-w-[380px] object-contain" />
        ) : (
          <FlobamaLogo className="h-[88px] w-auto" />
        )}
        <div>
          <p className="text-[18px] tracking-[0.22em] text-[var(--trivia-accent)] uppercase">
            {tease ? "Top 3 this round" : "Final scores"}
          </p>
          <h2 className="text-[52px] leading-none">{wall.packTitle}</h2>
          <p className="mt-1 text-[22px] text-[var(--trivia-muted)]">{playing}</p>
        </div>
      </div>
      <ol className="mt-8 max-w-[1100px] space-y-3">
        {rows.length === 0 ? (
          <li className="text-[32px] text-[var(--trivia-muted-strong)]">Waiting for scores…</li>
        ) : (
          rows.map((entry) => (
            <li
              key={entry.playerId}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-6 py-3"
            >
              <div className="flex items-center gap-5">
                <span className="w-14 text-[32px] text-[var(--trivia-accent)]">#{entry.rank}</span>
                <span className="text-[32px]">{entry.displayName}</span>
              </div>
              <span className="font-sans text-[32px] tabular-nums">{entry.score}</span>
            </li>
          ))
        )}
      </ol>
      <CornerJoin qr={qr} joinUrl={joinUrl} code={wall.joinCode} hint="Still open" />
    </div>
  );
}

function CornerJoin({
  qr,
  joinUrl,
  code,
  hint,
}: {
  qr: string | null;
  joinUrl: string | null;
  code: string;
  hint: string;
}) {
  return (
    <div className="absolute top-8 right-8 z-20 flex w-[250px] flex-col items-center">
      <QrPlate qr={qr} size={220} />
      <p className="mt-3 text-center text-[18px] text-[var(--trivia-text)]">{hint}</p>
      <p className="mt-1 text-[42px] leading-none tracking-[0.12em]">{code}</p>
      <p className="mt-2 text-center font-sans text-[14px] leading-snug text-[var(--trivia-muted)]">
        {shortJoinParts(joinUrl).host}
        <br />
        {shortJoinParts(joinUrl).path}
      </p>
    </div>
  );
}

function QrPlate({ qr, size }: { qr: string | null; size: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-[28px] bg-[var(--trivia-text)] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.35)]"
      style={{ width: size, height: size }}
    >
      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt="Join trivia QR code" className="h-full w-full object-contain" />
      ) : (
        <div className="h-[70%] w-[70%] animate-pulse rounded-xl bg-[color-mix(in_srgb,var(--trivia-muted)_55%,white)]" />
      )}
    </div>
  );
}
