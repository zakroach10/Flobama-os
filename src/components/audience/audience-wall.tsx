"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { AUDIENCE_POLL_MS } from "@/lib/constants";
import type { AudienceWallState, AudienceWallTool } from "@/lib/audience/types";

export function AudienceWall({ initial }: { initial: AudienceWallState }) {
  const [wall, setWall] = useState(initial);
  const [qr, setQr] = useState<string | null>(null);
  const joinUrl = useMemo(() => {
    if (typeof window === "undefined") return wall.joinPath;
    return `${window.location.origin}${wall.joinPath}`;
  }, [wall.joinPath]);

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(joinUrl, { margin: 1, width: 280 }).then((url) => {
      if (!cancelled) setQr(url);
    });
    return () => {
      cancelled = true;
    };
  }, [joinUrl]);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const res = await fetch("/api/public/v1/audience/wall", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { wall?: AudienceWallState | null };
        if (!cancelled && json.wall) setWall(json.wall);
      } catch {
        /* keep frame */
      }
    }
    const id = window.setInterval(() => void refresh(), AUDIENCE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const tool = wall.tool;
  const endsAt = typeof tool?.payload.endsAt === "string" ? tool.payload.endsAt : null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [endsAt]);

  const countdownLabel = useMemo(() => {
    if (!endsAt) {
      const seconds = Number(tool?.payload.seconds ?? 0);
      if (!seconds) return null;
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}:${String(s).padStart(2, "0")}`;
    }
    const left = Math.max(0, Math.floor((Date.parse(endsAt) - now) / 1000));
    const m = Math.floor(left / 60);
    const s = left % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }, [endsAt, now, tool?.payload.seconds]);

  return (
    <div className="relative flex h-full w-full flex-col bg-[#07090d] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(230,57,70,0.22),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(255,196,0,0.16),transparent_35%)]" />
      <header className="relative z-10 flex items-start justify-between gap-6 px-10 pt-8">
        <div>
          <p className="text-sm font-semibold tracking-[0.28em] text-white/55 uppercase">FloBama Live</p>
          <h1 className="mt-2 text-5xl font-black tracking-tight">{wall.title}</h1>
          <p className="mt-2 text-xl text-white/70">{wall.lobbyMessage}</p>
        </div>
        <div className="rounded-2xl bg-white p-3 text-center text-black">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="" className="size-40" />
          ) : (
            <div className="size-40 bg-neutral-200" />
          )}
          <p className="mt-2 font-mono text-2xl font-bold tracking-[0.2em]">{wall.joinCode}</p>
          <p className="text-xs text-neutral-600">{wall.guestCount} joined</p>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-12 pb-12">
        {!tool ? (
          <p className="text-4xl font-semibold text-white/80">Scan to join — stand by for the next interaction</p>
        ) : tool.kind === "message" ? (
          <div className="max-w-5xl text-center">
            <p className="text-6xl font-black tracking-tight md:text-7xl">{String(tool.payload.text ?? tool.title)}</p>
            {tool.payload.subtitle ? (
              <p className="mt-6 text-3xl text-white/75">{String(tool.payload.subtitle)}</p>
            ) : null}
          </div>
        ) : tool.kind === "countdown" ? (
          <div className="text-center">
            <p className="text-3xl font-semibold tracking-wide text-white/70 uppercase">
              {String(tool.payload.label ?? tool.title)}
            </p>
            <p className="mt-4 font-mono text-8xl font-black tabular-nums">{countdownLabel ?? "--:--"}</p>
          </div>
        ) : tool.kind === "matchup" ? (
          <div className="grid w-full max-w-5xl grid-cols-[1fr_auto_1fr] items-center gap-8">
            <TeamSide name={String(tool.payload.teamA ?? "Team A")} logo={String(tool.payload.logoA ?? "")} />
            <div className="text-center">
              <p className="text-4xl font-black">VS</p>
              <p className="mt-3 text-xl text-white/70">{String(tool.payload.kickoff ?? "")}</p>
              <p className="mt-6 text-2xl font-semibold">{String(tool.payload.prompt ?? "")}</p>
            </div>
            <TeamSide name={String(tool.payload.teamB ?? "Team B")} logo={String(tool.payload.logoB ?? "")} />
          </div>
        ) : tool.kind === "pickem_promo" ? (
          <PromoCard
            title={String(tool.payload.title ?? tool.title)}
            deadline={String(tool.payload.deadline ?? "")}
            prize={String(tool.payload.prize ?? "")}
            qrUrl={String(tool.payload.qrUrl ?? "")}
          />
        ) : tool.kind === "leaderboard" ? (
          <LeaderboardCard payload={tool.payload} title={tool.title} />
        ) : tool.kind === "sponsor" ? (
          <div className="max-w-4xl text-center">
            {tool.payload.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={String(tool.payload.imageUrl)}
                alt=""
                className="mx-auto mb-8 max-h-64 object-contain"
              />
            ) : null}
            <p className="text-5xl font-black">{String(tool.payload.name ?? tool.title)}</p>
            <p className="mt-4 text-2xl text-white/75">{String(tool.payload.blurb ?? "")}</p>
          </div>
        ) : tool.kind === "questions" ? (
          <div className="max-w-5xl text-center">
            {tool.questionOnWall ? (
              <>
                <p className="text-xl tracking-[0.2em] text-amber-300 uppercase">Audience question</p>
                <p className="mt-6 text-5xl font-black leading-tight">“{tool.questionOnWall.body}”</p>
                <p className="mt-6 text-2xl text-white/70">— {tool.questionOnWall.displayName}</p>
              </>
            ) : (
              <p className="text-4xl font-semibold text-white/80">Submit your questions — producer is reviewing</p>
            )}
          </div>
        ) : tool.kind === "host_picks" ? (
          <HostPicksWall tool={tool} />
        ) : (
          <PollWall tool={tool} />
        )}
      </main>
    </div>
  );
}

function TeamSide({ name, logo }: { name: string; logo: string }) {
  return (
    <div className="text-center">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="mx-auto mb-4 h-28 w-28 object-contain" />
      ) : (
        <div className="mx-auto mb-4 flex h-28 w-28 items-center justify-center rounded-full bg-white/10 text-3xl font-black">
          {name.slice(0, 1)}
        </div>
      )}
      <p className="text-4xl font-black">{name}</p>
    </div>
  );
}

function PromoCard({
  title,
  deadline,
  prize,
  qrUrl,
}: {
  title: string;
  deadline: string;
  prize: string;
  qrUrl: string;
}) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    if (!qrUrl) return;
    void QRCode.toDataURL(qrUrl, { margin: 1, width: 260 }).then(setQr);
  }, [qrUrl]);
  return (
    <div className="flex max-w-5xl items-center gap-12">
      <div>
        <p className="text-5xl font-black">{title}</p>
        <p className="mt-4 text-2xl text-white/80">{deadline}</p>
        <p className="mt-3 text-3xl font-semibold text-amber-300">{prize}</p>
      </div>
      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt="" className="size-56 rounded-xl bg-white p-3" />
      ) : null}
    </div>
  );
}

function LeaderboardCard({ payload, title }: { payload: Record<string, unknown>; title: string }) {
  const entries = Array.isArray(payload.entries) ? payload.entries : [];
  const spotlight = Number(payload.spotlightIndex ?? 0);
  return (
    <div className="w-full max-w-3xl">
      <p className="text-center text-4xl font-black">{String(payload.title ?? title)}</p>
      <ul className="mt-8 space-y-3">
        {entries.slice(0, 8).map((entry, index) => {
          const row = entry as { name?: string; points?: number };
          const active = index === spotlight;
          return (
            <li
              key={`${row.name}-${index}`}
              className={`flex items-center justify-between rounded-xl px-6 py-4 text-2xl ${
                active ? "bg-amber-400 text-black" : "bg-white/10"
              }`}
            >
              <span className="font-semibold">
                {index + 1}. {String(row.name ?? "Player")}
              </span>
              <span className="font-mono font-bold">{Number(row.points ?? 0)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PollWall({ tool }: { tool: AudienceWallTool }) {
  const prompt =
    tool.kind === "hot_take"
      ? String(tool.payload.statement ?? tool.title)
      : String(tool.payload.prompt ?? tool.title);
  const max = Math.max(1, ...tool.tallies.map((row) => row.count));
  return (
    <div className="w-full max-w-4xl">
      <p className="text-center text-4xl font-black leading-tight md:text-5xl">{prompt}</p>
      {!tool.resultsRevealed ? (
        <p className="mt-8 text-center text-2xl text-amber-300">
          Voting {tool.votingOpen ? "open" : "closed"} · results hidden until reveal
          {tool.totalVotes ? ` · ${tool.totalVotes} votes in` : ""}
        </p>
      ) : null}
      <ul className="mt-10 space-y-4">
        {tool.tallies.map((row) => (
          <li key={row.key} className="rounded-xl bg-white/10 px-5 py-4">
            <div className="flex items-center justify-between text-2xl font-semibold">
              <span>{row.label}</span>
              {tool.resultsRevealed ? <span className="font-mono">{row.count}</span> : null}
            </div>
            {tool.resultsRevealed ? (
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-black/40">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all duration-500"
                  style={{ width: `${Math.round((row.count / max) * 100)}%` }}
                />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function HostPicksWall({ tool }: { tool: AudienceWallTool }) {
  const hostA = (tool.payload.hostA ?? {}) as { name?: string; pick?: string; revealed?: boolean };
  const hostB = (tool.payload.hostB ?? {}) as { name?: string; pick?: string; revealed?: boolean };
  const audienceLeader = [...tool.tallies].sort((a, b) => b.count - a.count)[0];
  return (
    <div className="w-full max-w-5xl">
      <p className="text-center text-4xl font-black">{String(tool.payload.prompt ?? tool.title)}</p>
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        <HostCard
          name={String(hostA.name ?? "Austin")}
          pick={hostA.revealed ? String(hostA.pick ?? "—") : "???"}
          tone="rose"
        />
        <HostCard
          name={String(hostB.name ?? "Hunter")}
          pick={hostB.revealed ? String(hostB.pick ?? "—") : "???"}
          tone="sky"
        />
        <HostCard
          name={String(tool.payload.audienceLabel ?? "Audience")}
          pick={
            tool.resultsRevealed && audienceLeader
              ? `${audienceLeader.label} (${audienceLeader.count})`
              : tool.votingOpen
                ? "Voting…"
                : "Hidden"
          }
          tone="amber"
        />
      </div>
    </div>
  );
}

function HostCard({ name, pick, tone }: { name: string; pick: string; tone: "rose" | "sky" | "amber" }) {
  const bg =
    tone === "rose" ? "bg-rose-500/20" : tone === "sky" ? "bg-sky-500/20" : "bg-amber-400/20";
  return (
    <div className={`rounded-2xl ${bg} px-6 py-8 text-center`}>
      <p className="text-xl tracking-[0.18em] text-white/70 uppercase">{name}</p>
      <p className="mt-4 text-4xl font-black">{pick}</p>
    </div>
  );
}
