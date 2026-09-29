"use client";

import { useState, useEffect } from "react";
import { X, Music } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { fetchParsedEvents, ParsedEvent } from "@/lib/site/events";

function parseTimeString(
  timeStr: string,
  eventDate: Date,
): { start: Date; end: Date } | null {
  try {
    const parts = timeStr.split("-").map((s) => s.trim());
    const startStr = parts[0];
    const endStr = parts.length > 1 ? parts[1] : null;

    const parseTime = (tStr: string, baseDate: Date) => {
      const match = tStr.match(/(\d+)(?::(\d+))?\s*(am|pm)?/i);
      if (!match) return null;
      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2] || "0", 10);
      const ampm = (match[3] || "").toLowerCase();

      if (ampm === "pm" && hours < 12) hours += 12;
      if (ampm === "am" && hours === 12) hours = 0;
      if (!ampm && hours >= 1 && hours <= 11) hours += 12; // default PM

      const d = new Date(baseDate);
      d.setHours(hours, minutes, 0, 0);
      return d;
    };

    const start = parseTime(startStr, eventDate);
    if (!start) return null;

    let end = endStr
      ? parseTime(endStr, eventDate)
      : new Date(start.getTime() + 3 * 60 * 60 * 1000);

    if (end && end < start) {
      end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    }

    return { start, end: end! };
  } catch (e) {
    return null;
  }
}

export function NowPlayingWidget() {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const [eventData, setEventData] = useState<{
    band: string;
    time: string;
    status: "Now Playing" | "Up Next" | "Tonight";
  } | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    fetchParsedEvents()
      .then(({ events }) => {
        if (!events.length) return;

        const now = new Date();
        const today = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        );

        for (const ev of events) {
          if (!ev.parsedDate) continue;

          const eventDay = new Date(
            ev.parsedDate.getFullYear(),
            ev.parsedDate.getMonth(),
            ev.parsedDate.getDate(),
          );

          if (eventDay < today) {
            continue; // Past date
          }

          const eventName = ev.name || "Live Music";

          if (eventDay.getTime() === today.getTime()) {
            const times = parseTimeString(ev.time, ev.parsedDate);
            if (times) {
              if (now > times.end) {
                continue; // Event ended, check next
              } else if (now >= times.start && now <= times.end) {
                setEventData({
                  band: eventName,
                  time: ev.time,
                  status: "Now Playing",
                });
                return;
              } else {
                setEventData({
                  band: eventName,
                  time: ev.time,
                  status: "Up Next",
                });
                return;
              }
            } else {
              setEventData({
                band: eventName,
                time: ev.time,
                status: "Tonight",
              });
              return;
            }
          } else if (eventDay > today) {
            // Future date
            const dateDisplay = eventDay.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            });
            const displayTime = ev.time
              ? `${dateDisplay} • ${ev.time}`
              : dateDisplay;
            setEventData({
              band: eventName,
              time: displayTime,
              status: "Up Next",
            });
            return;
          }
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (isClosed || !eventData) return;

    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, [pathname, isClosed, eventData]);

  if (isClosed || !eventData) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 md:bottom-8 md:right-8 z-50 transition-all duration-700 transform ${
        isVisible
          ? "translate-y-0 opacity-100"
          : "translate-y-10 opacity-0 pointer-events-none"
      }`}
    >
      <div className="bg-card/95 backdrop-blur-md border border-border shadow-2xl rounded-xl p-5 w-[calc(100vw-32px)] sm:w-80 flex flex-col gap-3 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/20 blur-3xl rounded-full pointer-events-none"></div>

        <button
          onClick={() => setIsClosed(true)}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors z-10 bg-background/50 rounded-full p-1"
          aria-label="Close widget"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-2 mb-1">
          {eventData.status === "Now Playing" && (
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
            </span>
          )}
          <span className="text-xs font-heading font-bold uppercase tracking-widest text-primary">
            {eventData.status}
          </span>
        </div>

        <div className="relative z-10">
          <h4 className="font-heading font-bold text-xl uppercase tracking-wider leading-tight mb-1 text-foreground">
            {eventData.band}
          </h4>
          {eventData.time && (
            <p className="text-sm text-muted-foreground font-medium">
              {eventData.time}
            </p>
          )}
        </div>

        <Link
          href="/events"
          className="text-xs font-heading font-bold uppercase tracking-widest text-foreground hover:text-primary transition-colors mt-1 flex items-center gap-2 w-fit"
        >
          <Music size={14} />
          View Full Lineup
        </Link>
      </div>
    </div>
  );
}
