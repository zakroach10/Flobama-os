"use client";

import { useEffect, useState } from "react";
import { paginateWeekDays, type WeekSlidePayload } from "@/lib/screens/week";

export function WeekEventsSlide({
  week,
  loading = false,
}: {
  week: WeekSlidePayload | null;
  loading?: boolean;
}) {
  const pages = paginateWeekDays(week?.days ?? []);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (pages.length <= 1) return;
    const timer = window.setInterval(() => {
      setPage((value) => (value + 1) % pages.length);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [pages.length]);

  const current = pages[page % pages.length] ?? [];

  return (
    <div className="flex h-full w-full flex-col bg-[#1b1612] px-16 py-20 text-[#f4ebe3]">
      <header className="border-b border-[#c9b8aa]/25 pb-10">
        <p className="text-[28px] tracking-[0.28em] text-[#c9b8aa] uppercase">FloBama Music Hall</p>
        <h1 className="mt-5 font-serif text-[92px] leading-none">{week?.heading ?? "This week"}</h1>
        <p className="mt-6 text-[36px] text-[#e4c4b0]">{week?.rangeLabel ?? "Loading calendar"}</p>
      </header>

      <div className="min-h-0 flex-1 pt-10">
        {loading && !week ? (
          <p className="text-[40px] text-[#c9b8aa]">Loading this week…</p>
        ) : !week || week.eventCount === 0 ? (
          <p className="max-w-[16ch] text-[48px] leading-tight text-[#c9b8aa]">No public shows this week.</p>
        ) : (
          <ul className="space-y-10">
            {current.map((day) => (
              <li key={`${day.dateKey}-${day.events[0]?.id ?? "empty"}`}>
                <p className="text-[30px] font-medium tracking-wide text-[#d36b4a]">
                  {day.weekday} <span className="text-[#c9b8aa]">· {day.dateLabel}</span>
                </p>
                <ul className="mt-4 space-y-5">
                  {day.events.map((event) => (
                    <li key={event.id}>
                      <p className="text-[44px] leading-tight font-medium">{event.name}</p>
                      <p className="mt-1 text-[28px] text-[#c9b8aa]">
                        {event.time}
                        {event.artists.length > 0 ? ` · ${event.artists.join(", ")}` : ""}
                        {event.coverCharge ? ` · ${event.coverCharge}` : event.ticketed ? " · Tickets" : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pages.length > 1 ? (
        <p className="pt-8 text-[24px] tracking-wide text-[#c9b8aa]">
          {page + 1} / {pages.length}
        </p>
      ) : null}
    </div>
  );
}
