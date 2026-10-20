"use client";

import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";
import { DEFAULT_VENUE_TIMEZONE } from "@/lib/constants";
import {
  serverStationEventBandLabel,
  type ServerStationEventCard,
} from "@/lib/server-station/events";
import { StationLink, useStationEvents } from "@/components/server-station/station-nav";
import { cn } from "@/lib/utils";

function formatClock(now = DateTime.now(), timeZone = DEFAULT_VENUE_TIMEZONE) {
  return now.setZone(timeZone).toFormat("ccc, LLL d · h:mm a");
}

function tonightSummary(events: ServerStationEventCard[]) {
  if (events.length === 0) return null;
  const primary = serverStationEventBandLabel(events[0]!);
  const start = events[0]!.startLabel;
  if (events.length === 1) return { band: primary, start, more: 0 };
  return { band: primary, start, more: events.length - 1 };
}

export function ServerStationHeaderMeta({ className }: { className?: string }) {
  const { tonightEvents } = useStationEvents();
  const [clock, setClock] = useState(() => formatClock());
  const tonight = useMemo(() => tonightSummary(tonightEvents), [tonightEvents]);

  useEffect(() => {
    const tick = () => setClock(formatClock());
    tick();
    const timer = window.setInterval(tick, 15_000);
    return () => window.clearInterval(timer);
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
