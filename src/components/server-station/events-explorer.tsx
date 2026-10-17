"use client";

import { useEffect, useState, useTransition } from "react";
import { listServerStationEventsAction } from "@/actions/server-station";
import {
  ServerStationButton,
  ServerStationField,
  ServerStationShell,
  serverStationInputClass,
} from "@/components/server-station/shell";
import type { ServerStationEventCard } from "@/lib/server-station/events";
import type { ServerStationWallStatus } from "@/lib/server-station/wall-status-shared";
import { cn } from "@/lib/utils";

const BUCKETS = [
  { id: "tonight", label: "Tonight" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "weekend", label: "This Weekend" },
  { id: "upcoming", label: "Upcoming" },
  { id: "search", label: "Search" },
] as const;

export function ServerStationEventsExplorer({
  actorName,
  wall,
}: {
  actorName: string;
  wall: ServerStationWallStatus;
}) {
  const [bucket, setBucket] = useState<(typeof BUCKETS)[number]["id"]>("tonight");
  const [query, setQuery] = useState("");
  const [events, setEvents] = useState<ServerStationEventCard[]>([]);
  const [selected, setSelected] = useState<ServerStationEventCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    startTransition(async () => {
      const result = await listServerStationEventsAction({
        bucket,
        query: bucket === "search" ? query : undefined,
      });
      if (!result.ok) {
        setError(result.message);
        setEvents([]);
        return;
      }
      setError(null);
      setEvents(result.events);
      setSelected(null);
    });
  }, [bucket, query]);

  return (
    <ServerStationShell actorName={actorName} wall={wall} title="Explore Events">
      <div className="mb-5 space-y-2">
        <h1 className="text-3xl font-bold text-[#f7efe6]">What’s happening?</h1>
        <p className="text-lg text-[#e8d5c4]/90">Tap an event to read the details to a guest.</p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {BUCKETS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setBucket(item.id)}
            className={cn(
              "min-h-14 rounded-2xl px-5 text-base font-semibold",
              bucket === item.id ? "bg-[#d36b4a] text-white" : "border border-white/15 bg-white/5 text-[#f7efe6]",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {bucket === "search" ? (
        <div className="mb-5">
          <ServerStationField label="Search events">
            <input
              className={serverStationInputClass}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Band name or event title"
            />
          </ServerStationField>
        </div>
      ) : null}

      {error ? <p className="mb-4 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 text-amber-100">{error}</p> : null}
      {pending ? <p className="mb-4 text-[#e8d5c4]">Loading events…</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          {events.length === 0 && !pending ? (
            <p className="rounded-2xl border border-white/10 bg-black/20 p-5 text-lg text-[#e8d5c4]">
              No published public events in this window.
            </p>
          ) : null}
          {events.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => setSelected(event)}
              className={cn(
                "w-full rounded-2xl border p-5 text-left transition active:scale-[0.99]",
                selected?.id === event.id
                  ? "border-[#d36b4a] bg-[#d36b4a]/15"
                  : "border-white/10 bg-black/25",
              )}
            >
              <p className="text-xl font-bold text-[#f7efe6]">{event.title}</p>
              <p className="mt-1 text-base text-[#e8d5c4]">
                {event.dayLabel} · {event.startLabel}
                {event.endLabel ? ` – ${event.endLabel}` : ""}
              </p>
              {event.artists.length ? (
                <p className="mt-1 text-sm text-[#e8d5c4]/80">{event.artists.join(", ")}</p>
              ) : null}
            </button>
          ))}
        </div>

        <div className="rounded-[28px] border border-white/10 bg-black/30 p-6">
          {selected ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold tracking-[0.16em] text-[#d36b4a] uppercase">Read this</p>
                <h2 className="mt-2 text-3xl font-bold text-[#f7efe6]">{selected.title}</h2>
                {selected.artists.length ? (
                  <p className="mt-2 text-xl text-[#e8d5c4]">{selected.artists.join(", ")}</p>
                ) : null}
              </div>
              <p className="text-2xl font-semibold text-white">
                {selected.dayLabel} at {selected.startLabel}
              </p>
              {selected.endLabel ? (
                <p className="text-lg text-[#e8d5c4]">Ends around {selected.endLabel}</p>
              ) : null}
              <p className="text-2xl font-bold text-[#d36b4a]">
                {selected.coverLabel?.trim() || "Cover info not listed"}
              </p>
              {selected.publicDescription ? (
                <p className="whitespace-pre-wrap text-base leading-relaxed text-[#f7efe6]/90">
                  {selected.publicDescription}
                </p>
              ) : (
                <p className="text-base text-[#e8d5c4]/80">No public description on file.</p>
              )}
              {selected.ticketUrl ? (
                <p className="break-all text-base text-sky-200">Tickets: {selected.ticketUrl}</p>
              ) : null}
              <div className="flex flex-wrap gap-3 pt-2">
                <ServerStationButton
                  onClick={async () => {
                    await navigator.clipboard.writeText(selected.publicLink);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? "Link copied" : "Copy public link"}
                </ServerStationButton>
              </div>
            </div>
          ) : (
            <p className="text-lg text-[#e8d5c4]">Select an event to see guest-ready details.</p>
          )}
        </div>
      </div>
    </ServerStationShell>
  );
}
