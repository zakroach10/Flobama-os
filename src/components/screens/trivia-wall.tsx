"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import QRCode from "qrcode";
import { FlobamaLogo } from "@/components/brand/flobama-logo";
import { JoinPopups } from "@/components/screens/join-popups";
import { TRIVIA_POLL_MS, TRIVIA_WALL_CLEAR_HEIGHT } from "@/lib/constants";
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
  showSafeLine = false,
}: {
  initial: TriviaWallState | null;
  lockDemo?: boolean;
  /** Same-origin poll URL. The share page passes a token-scoped path. */
  pollPath?: string;
  /** Shown only while no game is on the wall. The in-app LED display leaves this unset. */
  empty?: ReactNode;
  /** Dev-only chair line at y=720. Production leaves this off. */
  showSafeLine?: boolean;
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
      {wall ? (
        <LiveTrivia wall={wall} qr={qrSrc} joinUrl={joinUrl} timer={timer} />
      ) : (
        empty
      )}
      {showSafeLine ? <ChairLine /> : null}
    </div>
  );
}

function ChairLine() {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-50 border-t-2 border-dashed border-white/90"
      style={{ top: 720 }}
      data-chair-line="720"
    >
      <span className="absolute top-2 left-4 font-sans text-sm tracking-[0.2em] text-white uppercase">
        Chair line
      </span>
    </div>
  );
}

function ClearStage({
  essential,
  washTitle,
}: {
  essential: ReactNode;
  washTitle: string;
}) {
  return (
    <div
      className="relative z-10 grid h-full"
      style={{ gridTemplateRows: `${TRIVIA_WALL_CLEAR_HEIGHT}px minmax(0, 1fr)` }}
    >
      <div data-above-chairs className="min-h-0 px-12 pt-5 pb-4">
        {essential}
      </div>
      <LowerBand title={washTitle} />
    </div>
  );
}

function LowerBand({ title }: { title: string }) {
  return (
    <div className="relative flex h-full items-center overflow-hidden border-t border-white/15 px-14">
      <p
        aria-hidden
        className="pointer-events-none absolute -bottom-8 left-8 max-w-none text-[168px] leading-none tracking-tight text-[var(--trivia-accent)] opacity-25"
      >
        {title}
      </p>
      <div className="relative flex w-full items-end justify-between gap-8 pb-6">
        <p className="text-[26px] tracking-[0.32em] text-[var(--trivia-muted)] uppercase">FloBama Music Hall</p>
        <FlobamaLogo className="h-[104px] w-auto opacity-90" />
      </div>
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
        <ClearStage
          washTitle={wall.packTitle}
          essential={<LobbyEssential wall={wall} joinUrl={joinUrl} qr={qr} playing={playing} timer={timer} />}
        />
      ) : null}
      {wall.status === "question" || wall.status === "reveal" ? (
        <ClearStage
          washTitle={wall.packTitle}
          essential={
            <QuestionEssential
              wall={wall}
              joinUrl={joinUrl}
              qr={qr}
              playing={playing}
              timer={timer}
              reveal={wall.status === "reveal"}
            />
          }
        />
      ) : null}
      {wall.status === "podium" || wall.status === "final" ? (
        <ClearStage
          washTitle={wall.status === "final" ? "Final" : "Standing"}
          essential={
            <PodiumEssential
              wall={wall}
              joinUrl={joinUrl}
              qr={qr}
              playing={playing}
              tease={wall.status === "podium"}
            />
          }
        />
      ) : null}
      <JoinPopups joins={wall.recentJoins} className="top-7 left-12 justify-start" />
    </div>
  );
}

function LobbyEssential({
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
    <div className="grid h-full grid-cols-[minmax(0,1fr)_440px] items-center gap-8">
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-6">
          <FlobamaLogo className="h-[64px] w-auto" priority />
          <div className="text-right">
            <p className="text-[18px] tracking-[0.26em] text-[var(--trivia-accent)] uppercase">Live trivia</p>
            <p className="text-[28px] leading-none">{playing}</p>
            {timer ? <p className="text-[28px] text-[var(--trivia-accent)] tabular-nums">{timer}</p> : null}
          </div>
        </div>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="mt-3 h-[150px] w-auto max-w-[640px] object-contain object-left" />
        ) : null}
        <h1 className={`max-w-[980px] leading-[0.92] ${logo ? "mt-3 text-[60px]" : "mt-4 text-[92px]"}`}>
          {wall.packTitle}
        </h1>
        <p className="mt-2 text-[26px] text-[var(--trivia-muted)]">{wall.packTheme}</p>
        <p className="mt-4 text-[48px] leading-none text-[var(--trivia-accent)]">Come play.</p>
        <p className="mt-2 text-[26px] text-[var(--trivia-text)]">Scan the code and pick a game name.</p>
        <p className="mt-4 text-[16px] tracking-[0.22em] text-[var(--trivia-muted-strong)] uppercase">Game code</p>
        <p className="text-[76px] leading-none tracking-[0.12em]">{wall.joinCode}</p>
      </div>
      <JoinQr qr={qr} joinUrl={joinUrl} size={390} caption="Point your camera here" />
    </div>
  );
}

function QuestionEssential({
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
    <div className="grid h-full grid-rows-[96px_minmax(0,1fr)] gap-3">
      <BrandHeader wall={wall} playing={playing} timer={timer} />
      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_300px] items-center gap-6">
        <QuestionFrame wall={wall} reveal={reveal} />
        <JoinQr qr={qr} joinUrl={joinUrl} size={220} caption="Jump in anytime" code={wall.joinCode} compact />
      </div>
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
            className="h-[84px] w-auto max-w-[280px] object-contain object-left"
          />
        ) : (
          <FlobamaLogo className="h-[64px] w-auto" />
        )}
        <div className="min-w-0">
          <p className="text-[16px] tracking-[0.24em] text-[var(--trivia-accent)] uppercase">Live trivia</p>
          <p className="truncate text-[36px] leading-none">{wall.packTitle}</p>
        </div>
      </div>
      <div className="shrink-0 rounded-3xl border border-white/15 bg-black/35 px-6 py-2 text-right">
        <p className="text-[14px] tracking-[0.2em] text-[var(--trivia-muted-strong)] uppercase">Players</p>
        <p className="text-[32px] leading-none tabular-nums">{wall.playerCount}</p>
        <p className="text-[16px] text-[var(--trivia-muted)]">{playing}</p>
        {timer ? <p className="text-[34px] leading-none text-[var(--trivia-accent)] tabular-nums">{timer}</p> : null}
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
      <p className="text-[18px] tracking-[0.22em] text-[var(--trivia-accent)] uppercase">
        Question {question.index + 1} / {wall.questionCount}
      </p>
      <h2 className="mt-2 max-w-[1200px] text-[48px] leading-[1.05]">{question.prompt}</h2>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {question.choices.map((choice, index) => {
          const isCorrect = reveal && question.correctIndex === index;
          const isWrong = reveal && question.correctIndex !== index;
          return (
            <div
              key={`${question.index}-${index}`}
              className={`rounded-2xl border px-5 py-3 text-[30px] leading-tight ${
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
        <p className="mt-3 text-[24px] text-[var(--trivia-accent)]">Correct answer highlighted</p>
      ) : null}
    </div>
  );
}

function PodiumEssential({
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
  const rows = tease ? wall.top3 : wall.leaderboard.slice(0, 5);
  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)_280px] items-center gap-6">
      <div className="min-h-0">
        <div className="flex items-center gap-5">
          {wall.brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={wall.brand.logoUrl} alt="" className="h-[88px] w-auto max-w-[280px] object-contain" />
          ) : (
            <FlobamaLogo className="h-[64px] w-auto" />
          )}
          <div>
            <p className="text-[16px] tracking-[0.22em] text-[var(--trivia-accent)] uppercase">
              {tease ? "Top 3 this round" : "Final scores"}
            </p>
            <h2 className="text-[44px] leading-none">{wall.packTitle}</h2>
            <p className="mt-1 text-[20px] text-[var(--trivia-muted)]">{playing}</p>
          </div>
        </div>
        <ol className="mt-4 space-y-2">
          {rows.length === 0 ? (
            <li className="text-[28px] text-[var(--trivia-muted-strong)]">Waiting for scores…</li>
          ) : (
            rows.map((entry) => (
              <li
                key={entry.playerId}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-5 py-2"
              >
                <div className="flex items-center gap-4">
                  <span className="w-12 text-[28px] text-[var(--trivia-accent)]">#{entry.rank}</span>
                  <span className="text-[28px]">{entry.displayName}</span>
                </div>
                <span className="font-sans text-[28px] tabular-nums">{entry.score}</span>
              </li>
            ))
          )}
        </ol>
      </div>
      <JoinQr qr={qr} joinUrl={joinUrl} size={200} caption="Still open" code={wall.joinCode} compact />
    </div>
  );
}

function JoinQr({
  qr,
  joinUrl,
  size,
  caption,
  code,
  compact = false,
}: {
  qr: string | null;
  joinUrl: string | null;
  size: number;
  caption: string;
  code?: string;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <QrPlate qr={qr} size={size} />
      <p className={`text-center text-[var(--trivia-text)] ${compact ? "mt-2 text-[20px]" : "mt-3 text-[24px]"}`}>
        {caption}
      </p>
      {code ? (
        <p className={`leading-none tracking-[0.12em] ${compact ? "mt-1 text-[36px]" : "mt-1 text-[44px]"}`}>{code}</p>
      ) : null}
      <p className="mt-1 max-w-[420px] text-center font-sans text-[18px] text-[var(--trivia-muted)]">
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
