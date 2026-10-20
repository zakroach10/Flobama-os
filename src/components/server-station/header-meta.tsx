"use client";

import { useEffect, useState } from "react";
import { DateTime } from "luxon";
import { listServerStationEventsAction } from "@/actions/server-station";
import { DEFAULT_VENUE_TIMEZONE } from "@/lib/constants";
import {
  isServerStationEventTonight,
  serverStationEventBandLabel,
  type ServerStationEventCard,
} from "@/lib/server-station/events";
import { StationLink } from "@/components/server-station/station-nav";
import { cn } from "@/lib/utils";

function formatClock(now = DateTime.now(), timeZone = DEFAULT_VENUE_TIMEZONE) {
  return now.setZone(timeZone).toFormat("ccc, LLL d · h:mm a");
}

function tonightSummary(events: ServerStationEventCard[]) {
  const tonight = events.filter((event) => isServerStationEventTonight(event));
  if (tonight.length === 0) return null;
  const primary = serverStationEventBandLabel(tonight[0]!);
  const start = tonight[0]!.startLabel;
  if (tonight.length === 1) return { band: primary, start, more: 0 };
  return { band: primary, start, more: tonight.length - 1 };
}

export function ServerStationHeaderMeta({ className }: { className?: string }) {
  const [clock, setClock] = useState(() => formatClock());
  const [tonight, setTonight] = useState<{ band: string; start: string; more: number } | null>(null);

  useEffect(() => {
    const tick = () => setClock(formatClock());
    tick();
    const timer = window.setInterval(tick, 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let alive = true;
    async function load() {
      const result = await listServerStationEventsAction({ bucket: "tonight" });
      if (!alive || !result.ok) return;
      setTonight(tonightSummary(result.events));
    }
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className={cn("min-w-0 text-right", className)}>
      <p className="truncate text-[11px] font-semibold tabular-nums text-[#f7efe6] sm:text-sm">{clock}</p>
      {tonight ? (
        <StationLink
          href="/server/events"
          className="mt-0.5 block truncate text-[11px] font-semibold text-[#d36b4a] sm:text-xs"
        >
          Tonight: {tonight.band}
          {tonight.more > 0 ? ` +${tonight.more}` : ""} · {tonight.start}
        </StationLink>
      ) : (
        <p className="mt-0.5 truncate text-[11px] text-[#e8d5c4]/80 sm:text-xs">No show listed tonight</p>
      )}
    </div>
  );
}
