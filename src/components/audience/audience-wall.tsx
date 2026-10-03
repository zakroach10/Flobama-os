"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { AUDIENCE_POLL_MS } from "@/lib/constants";
import type { AudienceCornerSponsor, AudienceWallState, AudienceWallTool } from "@/lib/audience/types";
import { JoinPopups } from "@/components/screens/join-popups";

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

  const sponsorPhone = String(tool?.payload.phone ?? "").trim();

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#07090d] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(230,57,70,0.22),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(255,196,0,0.16),transparent_35%)]" />

      {wall.brandLogoUrl && tool ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={wall.brandLogoUrl}
          alt=""
          className="pointer-events-none absolute top-5 left-1/2 z-30 h-20 w-auto max-w-[16rem] -translate-x-1/2 object-contain"
        />
      ) : null}

      <main
        className={`absolute inset-0 z-10 flex flex-col items-center justify-center px-12 ${
          wall.brandLogoUrl && tool ? "pt-28 pb-8" : "py-6"
        }`}
      >
        {!tool ? (
          wall.brandLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={wall.brandLogoUrl}
              alt=""
              className="max-h-[68vh] w-auto max-w-[78vw] object-contain"
            />
          ) : (
            <p className="text-center text-4xl font-semibold text-white/80">
              Scan to join — stand by for the next interaction
            </p>
          )
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
        ) : tool.kind === "sponsor" ? (
          <div className="flex max-w-4xl flex-col items-center text-center">
            <div className="rounded-[2rem] bg-white px-12 py-10 text-black shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
              {tool.payload.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={String(tool.payload.imageUrl)}
                  alt=""
                  className="mx-auto mb-6 max-h-56 object-contain"
                />
              ) : null}
              <p className="text-5xl font-black">{String(tool.payload.name ?? tool.title)}</p>
            </div>
            {sponsorPhone ? (
              <p className="mt-6 font-mono text-4xl font-bold tracking-wide">{sponsorPhone}</p>
            ) : null}
            {String(tool.payload.blurb ?? "").trim() ? (
              <p className="mt-3 max-w-3xl text-3xl font-semibold text-white/85">
                {String(tool.payload.blurb).trim()}
              </p>
            ) : null}
          </div>
        ) : tool.kind === "picture" ? (
          <div className="flex h-full w-full max-w-6xl flex-col items-center justify-center gap-6">
            {tool.payload.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={String(tool.payload.imageUrl)}
                alt=""
                className="max-h-[min(70vh,820px)] w-auto max-w-full rounded-2xl object-contain shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
              />
            ) : (
              <p className="text-3xl font-semibold text-white/70">Picture not uploaded yet</p>
            )}
            {tool.payload.caption ? (
              <p className="max-w-4xl text-center text-3xl font-semibold text-white/85">
                {String(tool.payload.caption)}
              </p>
            ) : null}
          </div>
        ) : tool.kind === "questions" ? (
          <div className="mx-auto w-full max-w-5xl text-center">
            {tool.questionOnWall ? (
              <>
                <p className="text-xl tracking-[0.2em] text-amber-300 uppercase">Audience question</p>
                <p className="mt-6 text-5xl font-black leading-tight md:text-6xl">“{tool.questionOnWall.body}”</p>
                <p className="mt-6 text-3xl text-white/70">— {tool.questionOnWall.displayName}</p>
              </>
            ) : (
              <p className="text-4xl font-semibold text-white/80">Submit your questions — producer is reviewing</p>
            )}
          </div>
        ) : tool.kind === "host_picks" ? (
          <HostPicksWall tool={tool} />
        ) : tool.kind === "poll" || tool.kind === "hot_take" ? (
          <PollWall tool={tool} />
        ) : (
          <p className="text-4xl font-semibold text-white/80">Scan to join — stand by for the next interaction</p>
        )}
      </main>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-8 px-10 pt-8">
        <div>
          <p className="text-sm font-semibold tracking-[0.28em] text-white/55 uppercase">FloBama Live</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">{wall.title}</h1>
          <p className="mt-2 text-xl text-white/70">{wall.lobbyMessage}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-4">
          <div className="rounded-2xl bg-white p-3 text-center text-black">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="" className="size-32" />
            ) : (
              <div className="size-32 bg-neutral-200" />
            )}
            <p className="mt-2 font-mono text-2xl font-bold tracking-[0.2em]">{wall.joinCode}</p>
            <p className="text-xs text-neutral-600">{wall.guestCount} joined</p>
          </div>
        </div>
      </header>
      {!tool && wall.brandLogoUrl ? (
        <p className="pointer-events-none absolute inset-x-0 bottom-16 z-20 px-10 text-center text-3xl font-semibold text-white/80">
          Scan to join — stand by for the next interaction
        </p>
      ) : null}
      {wall.cornerSponsor ? <CornerSponsorBug sponsor={wall.cornerSponsor} /> : null}
      <JoinPopups joins={wall.recentJoins} />
    </div>
  );
}

function CornerSponsorBug({ sponsor }: { sponsor: AudienceCornerSponsor }) {
  const right = sponsor.corner === "bottom-right";
  const corner = right ? "bottom-10 right-10 items-end text-right" : "bottom-10 left-10 items-start text-left";
  return (
    <div className={`pointer-events-none absolute z-30 flex flex-col ${corner}`}>
      <div className="flex max-w-md items-center gap-4 rounded-3xl bg-white px-5 py-4 text-black shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
        {sponsor.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sponsor.imageUrl}
            alt={sponsor.name ? "" : "Sponsor"}
            className="h-20 w-auto max-w-48 shrink-0 object-contain"
          />
        ) : null}
        {sponsor.name ? (
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.22em] text-neutral-500 uppercase">Presented by</p>
            <p className="truncate text-3xl font-black leading-tight">{sponsor.name}</p>
          </div>
        ) : null}
      </div>
      {sponsor.phone ? (
        <p className="mt-3 max-w-md font-mono text-3xl font-bold tracking-wide text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
          {sponsor.phone}
        </p>
      ) : null}
      {sponsor.message ? (
        <p className="mt-1 max-w-md text-2xl font-semibold text-white/90 drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
          {sponsor.message}
        </p>
      ) : null}
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
