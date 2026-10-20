"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchIcon, XIcon } from "lucide-react";
import {
  ServerStationButton,
  ServerStationField,
  ServerStationShell,
  serverStationInputClass,
} from "@/components/server-station/shell";
import { useStationEvents } from "@/components/server-station/station-nav";
import {
  isServerStationEventTonight,
  serverStationEventBandLabel,
  type ServerStationEventCard,
} from "@/lib/server-station/events";
import type { ServerStationWallStatus } from "@/lib/server-station/wall-status-shared";
import { cn } from "@/lib/utils";

export function ServerStationEventsExplorer({
  actorName,
  wall,
}: {
  actorName: string;
  wall: ServerStationWallStatus;
}) {
  const { events, error, pending } = useStationEvents();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ServerStationEventCard | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return events;
    return events.filter(
      (event) =>
        event.title.toLowerCase().includes(needle) ||
        event.artists.some((name) => name.toLowerCase().includes(needle)) ||
        (event.publicDescription ?? "").toLowerCase().includes(needle) ||
        event.dayLabel.toLowerCase().includes(needle),
    );
  }, [events, query]);

  return (
    <ServerStationShell actorName={actorName} wall={wall} title="Explore Events">
      <div className="mb-4 space-y-1 lg:mb-5 lg:space-y-2">
        <h1 className="text-2xl font-bold text-[#f7efe6] lg:text-3xl">What’s happening?</h1>
        <p className="text-base text-[#e8d5c4]/90 lg:text-lg">
          All upcoming shows in one list. Tonight’s band is highlighted — tap any event for details.
        </p>
      </div>

      <div className="mb-5">
        <ServerStationField label="Search events">
          <div className="relative">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-[#e8d5c4]/70"
              aria-hidden
            />
            <input
              className={cn(serverStationInputClass, "pl-12")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Band name, title, or day"
            />
          </div>
        </ServerStationField>
      </div>

      {error && events.length === 0 ? (
        <p className="mb-4 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 text-amber-100">{error}</p>
      ) : null}
      {pending && events.length === 0 ? <p className="mb-4 text-[#e8d5c4]">Loading events…</p> : null}

      <div className="space-y-3 pb-6">
        {visible.length === 0 && !pending ? (
          <p className="rounded-2xl border border-white/10 bg-black/20 p-5 text-lg text-[#e8d5c4]">
            {query.trim() ? "No events match that search." : "No published public events coming up."}
          </p>
        ) : null}
        {visible.map((event) => {
          const tonight = isServerStationEventTonight(event);
          const band = serverStationEventBandLabel(event);
          return (
            <button
              key={event.id}
              type="button"
              onClick={() => {
                setCopied(false);
                setSelected(event);
              }}
              className={cn(
                "w-full rounded-2xl border p-5 text-left transition active:scale-[0.99]",
                tonight
                  ? "border-[#d36b4a] bg-[#d36b4a]/20 shadow-[0_0_0_1px_rgba(211,107,74,0.35)]"
                  : "border-white/10 bg-black/25",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                {tonight ? (
                  <span className="rounded-full bg-[#d36b4a] px-2.5 py-0.5 text-[11px] font-bold tracking-[0.14em] text-white uppercase">
                    Tonight
                  </span>
                ) : null}
                <p className="text-xl font-bold text-[#f7efe6]">{band}</p>
              </div>
              {event.artists.length && event.title !== band ? (
                <p className="mt-1 text-base text-[#e8d5c4]">{event.title}</p>
              ) : null}
              <p className="mt-1 text-base text-[#e8d5c4]">
                {event.dayLabel} · {event.startLabel}
                {event.endLabel ? ` – ${event.endLabel}` : ""}
              </p>
            </button>
          );
        })}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center p-3 sm:items-center sm:p-6">
          <button
            type="button"
            aria-label="Close event details"
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={selected.title}
            className="relative z-10 max-h-[min(88vh,40rem)] w-full max-w-xl overflow-y-auto rounded-[28px] border border-white/15 bg-[#1a1613] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                {isServerStationEventTonight(selected) ? (
                  <p className="text-sm font-semibold tracking-[0.16em] text-[#d36b4a] uppercase">Tonight</p>
                ) : (
                  <p className="text-sm font-semibold tracking-[0.16em] text-[#e8d5c4] uppercase">Read this</p>
                )}
                <h2 className="mt-2 text-3xl font-bold text-[#f7efe6]">
                  {serverStationEventBandLabel(selected)}
                </h2>
                {selected.artists.length && selected.title !== serverStationEventBandLabel(selected) ? (
                  <p className="mt-2 text-xl text-[#e8d5c4]">{selected.title}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-[#f7efe6]"
                aria-label="Close"
              >
                <XIcon className="size-5" aria-hidden />
              </button>
            </div>
            <div className="space-y-4">
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
              <div className="flex flex-wrap justify-end gap-3 pt-2">
                <ServerStationButton variant="secondary" onClick={() => setSelected(null)}>
                  Close
                </ServerStationButton>
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
          </div>
        </div>
      ) : null}
    </ServerStationShell>
  );
}
