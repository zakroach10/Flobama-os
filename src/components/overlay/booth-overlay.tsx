"use client";

import { useEffect, useState } from "react";
import type { PublicEventJson } from "@/lib/public/listings";

type NowPayload = {
  today: PublicEventJson[];
  nowPlaying: PublicEventJson | null;
  next: PublicEventJson | null;
  lowerThirdVisible: boolean;
};

export function BoothOverlay() {
  const [data, setData] = useState<NowPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/public/v1/now", { cache: "no-store" });
        const json = (await response.json()) as NowPayload & { error?: string };
        if (!response.ok) throw new Error(json.error ?? "Could not load overlay.");
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load overlay.");
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 10000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const current = data?.nowPlaying ?? happening(data?.today ?? []);
  const next = data?.next && data.next.id !== current?.id ? data.next : null;
  const showLower = Boolean(data?.lowerThirdVisible && current);

  return (
    <div className="relative h-[1080px] w-[1920px] overflow-hidden bg-transparent text-white">
      {error ? <p className="absolute top-8 left-8 text-sm text-white/60">{error}</p> : null}
      {showLower && current ? (
        <div className="absolute right-16 bottom-16 left-16 flex items-end justify-between gap-8">
          <div className="max-w-4xl rounded-2xl bg-[#1b1612]/92 px-10 py-7 shadow-2xl ring-1 ring-[#d4573c]/40">
            <p className="text-sm tracking-[0.35em] text-[#d4573c] uppercase">Now playing</p>
            <p className="mt-2 text-6xl leading-none font-semibold tracking-tight">{current.name}</p>
            <p className="mt-3 text-2xl text-[#c9b8aa]">
              {current.time}
              {current.coverCharge ? ` · ${current.coverCharge}` : ""}
              {current.ticketed ? " · Tickets at the door / online" : ""}
            </p>
          </div>
          {next ? (
            <div className="rounded-2xl bg-black/70 px-8 py-6 text-right ring-1 ring-white/10">
              <p className="text-sm tracking-[0.3em] text-[#f0a089] uppercase">Next up</p>
              <p className="mt-2 text-3xl font-semibold">{next.name}</p>
              <p className="mt-1 text-xl text-[#c9b8aa]">{next.display}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function happening(events: PublicEventJson[]): PublicEventJson | null {
  const now = new Date().toISOString();
  return events.find((event) => event.startsAt <= now && event.endsAt > now) ?? null;
}
