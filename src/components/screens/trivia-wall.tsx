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

function shortJoinUrl(joinUrl: string | null) {
  if (!joinUrl) return "";
  try {
    const url = new URL(joinUrl);
    return `${url.host}${url.pathname}`;
  } catch {
    return joinUrl.replace(/^https?:\/\//, "");
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
    <div className={`${triviaDisplayFont.className} h-full w-full overflow-hidden`} style={{ fontSynthesis: "none" }}>
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
        <QuestionStage wall={wall} joinUrl={joinUrl} qr={qr} playing={playing} timer={timer} reveal={wall.status === "reveal"} />
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
    <div className="relative z-10 grid h-full grid-rows-[112px_minmax(0,1fr)] px-16 pt-8 pb-10">
      <div className="flex items-center justify-between gap-8">
        <FlobamaLogo className={logo ? "h-[78px] w-auto" : "h-[112px] w-auto"} priority />
        <div className="text-right">
          <p className="text-[22px] tracking-[0.28em] text-[var(--trivia-accent)] uppercase">Live trivia</p>
          <p className="mt-1 text-[32px] text-[var(--trivia-text)]">{playing}</p>
          {timer ? <p className="text-[26px] text-[var(--trivia-accent)] tabular-nums">{timer}</p> : null}
        </div>
      </div>
      <div className="grid min-h-0 grid-cols-[minmax(0,1.05fr)_640px] items-center gap-12">
        <div className="min-w-0">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt=""
              className="h-[300px] w-auto max-w-[760px] object-contain object-left"
            />
          ) : null}
          <h1
            className={`max-w-[860px] leading-[0.92] text-[var(--trivia-text)] ${
              logo ? "mt-6 text-[72px]" : "text-[128px]"
            }`}
          >
            {wall.packTitle}
          </h1>
          <p className="mt-3 text-[32px] text-[var(--trivia-muted)]">{wall.packTheme}</p>
          <p className="mt-8 text-[64px] leading-none text-[var(--trivia-accent)]">Come play.</p>
          <p className="mt-4 max-w-[760px] text-[32px] leading-snug text-[var(--trivia-text)]">
            Scan the code and pick a game name.
          </p>
          <p className="mt-8 text-[22px] tracking-[0.22em] text-[var(--trivia-muted-strong)] uppercase">Game code</p>
          <p className="mt-1 text-[92px] leading-none tracking-[0.12em] text-[var(--trivia-text)]">{wall.joinCode}</p>
        </div>
        <JoinQr qr={qr} joinUrl={joinUrl} size={560} caption="Point your camera here" />
      </div>
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
    <div className="relative z-10 grid h-full grid-rows-[148px_minmax(0,1fr)_188px] px-14 pt-7 pb-6">
      <BrandHeader wall={wall} playing={playing} timer={timer} />
      <QuestionFrame wall={wall} reveal={reveal} />
      <JoinStrip joinCode={wall.joinCode} joinUrl={joinUrl} qr={qr} hint="Jump in anytime" />
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
            className="h-[124px] w-auto max-w-[420px] object-contain object-left"
          />
        ) : (
          <FlobamaLogo className="h-[88px] w-auto" />
        )}
        <div className="min-w-0">
          <p className="text-[18px] tracking-[0.26em] text-[var(--trivia-accent)] uppercase">Live trivia</p>
          <p className="truncate text-[48px] leading-none">{wall.packTitle}</p>
        </div>
      </div>
      <div className="shrink-0 rounded-3xl border border-white/15 bg-black/35 px-7 py-3 text-right">
        <p className="text-[16px] tracking-[0.2em] text-[var(--trivia-muted-strong)] uppercase">Players</p>
        <p className="text-[40px] leading-none tabular-nums">{wall.playerCount}</p>
        <p className="mt-1 text-[18px] text-[var(--trivia-muted)]">{playing}</p>
        {timer ? <p className="mt-1 text-[36px] leading-none text-[var(--trivia-accent)] tabular-nums">{timer}</p> : null}
      </div>
    </div>
  );
}

function QuestionFrame({ wall, reveal }: { wall: TriviaWallState; reveal: boolean }) {
  const question = wall.question;
  if (!question) return null;
  const letters = ["A", "B", "C", "D"] as const;
  return (
    <div className="flex min-h-0 flex-col justify-center px-4">
      <p className="text-center text-[22px] tracking-[0.24em] text-[var(--trivia-accent)] uppercase">
        Question {question.index + 1} / {wall.questionCount}
      </p>
      <h2 className="mx-auto mt-3 max-w-[1600px] text-center text-[60px] leading-[1.05]">{question.prompt}</h2>
      <div className="mt-7 grid grid-cols-2 gap-4">
        {question.choices.map((choice, index) => {
          const isCorrect = reveal && question.correctIndex === index;
          const isWrong = reveal && question.correctIndex !== index;
          return (
            <div
              key={`${question.index}-${index}`}
              className={`rounded-2xl border px-7 py-5 text-[34px] leading-tight ${
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
        <p className="mt-4 text-center text-[28px] text-[var(--trivia-accent)]">Correct answer highlighted</p>
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
  const rows = tease ? wall.top3 : wall.leaderboard.slice(0, 8);
  return (
    <div className="relative z-10 grid h-full grid-cols-[minmax(0,1fr)_360px] gap-10 px-16 py-10">
      <div className="flex min-h-0 flex-col">
        <div className="flex items-center gap-6">
          {wall.brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={wall.brand.logoUrl} alt="" className="h-[140px] w-auto max-w-[460px] object-contain" />
          ) : (
            <FlobamaLogo className="h-[96px] w-auto" />
          )}
          <div>
            <p className="text-[20px] tracking-[0.24em] text-[var(--trivia-accent)] uppercase">
              {tease ? "Top 3 this round" : "Final scores"}
            </p>
            <h2 className="text-[64px] leading-none">{wall.packTitle}</h2>
            <p className="mt-2 text-[24px] text-[var(--trivia-muted)]">{playing}</p>
          </div>
        </div>
        <ol className="mt-8 min-h-0 space-y-3 overflow-hidden">
          {rows.length === 0 ? (
            <li className="text-[36px] text-[var(--trivia-muted-strong)]">Waiting for scores…</li>
          ) : (
            rows.map((entry) => (
              <li
                key={entry.playerId}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-6 py-4"
              >
                <div className="flex items-center gap-5">
                  <span className="w-16 text-[40px] text-[var(--trivia-accent)]">#{entry.rank}</span>
                  <span className="text-[36px]">{entry.displayName}</span>
                </div>
                <span className="font-sans text-[36px] tabular-nums">{entry.score}</span>
              </li>
            ))
          )}
        </ol>
      </div>
      <div className="flex flex-col items-center justify-center">
        <JoinQr qr={qr} joinUrl={joinUrl} size={280} caption="Still open" code={wall.joinCode} />
      </div>
    </div>
  );
}

function JoinStrip({
  joinCode,
  joinUrl,
  qr,
  hint,
}: {
  joinCode: string;
  joinUrl: string | null;
  qr: string | null;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-6 rounded-[28px] border border-white/10 bg-black/35 px-5">
      <QrPlate qr={qr} size={148} />
      <div className="min-w-0">
        <p className="text-[28px] leading-none text-[var(--trivia-accent)]">{hint}</p>
        <p className="mt-2 text-[48px] leading-none tracking-[0.14em]">{joinCode}</p>
        <p className="mt-2 truncate font-sans text-[22px] text-[var(--trivia-muted)]">{shortJoinUrl(joinUrl)}</p>
      </div>
    </div>
  );
}

function JoinQr({
  qr,
  joinUrl,
  size,
  caption,
  code,
}: {
  qr: string | null;
  joinUrl: string | null;
  size: number;
  caption: string;
  code?: string;
}) {
  return (
    <div className="flex flex-col items-center">
      <QrPlate qr={qr} size={size} />
      <p className="mt-5 text-center text-[28px] text-[var(--trivia-text)]">{caption}</p>
      {code ? <p className="mt-2 text-[56px] leading-none tracking-[0.12em]">{code}</p> : null}
      <p className="mt-2 max-w-[560px] text-center font-sans text-[24px] text-[var(--trivia-muted)]">
        {shortJoinUrl(joinUrl)}
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
