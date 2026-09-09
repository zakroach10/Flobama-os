import type { PublicEventJson } from "@/lib/public/listings";
import { DateTime } from "luxon";
import { FlobamaLogo } from "@/components/brand/flobama-logo";
import { DEFAULT_VENUE_TIMEZONE } from "@/lib/constants";

export function EventsEmbed({
  events,
  monthEvents,
  month,
  timeZone = DEFAULT_VENUE_TIMEZONE,
}: {
  events: PublicEventJson[];
  monthEvents?: PublicEventJson[];
  month: DateTime;
  timeZone?: string;
}) {
  const monthStart = month.setZone(timeZone).startOf("month");
  const daysInMonth = monthStart.daysInMonth ?? 30;
  const startWeekday = monthStart.weekday % 7;
  const byDay = new Map<number, PublicEventJson[]>();
  for (const event of monthEvents ?? events) {
    const local = DateTime.fromISO(event.startsAt, { zone: "utc" }).setZone(timeZone);
    if (local.year === monthStart.year && local.month === monthStart.month) {
      const list = byDay.get(local.day) ?? [];
      list.push(event);
      byDay.set(local.day, list);
    }
  }

  const cells: Array<{ day: number | null; events: PublicEventJson[] }> = [];
  for (let i = 0; i < startWeekday; i += 1) cells.push({ day: null, events: [] });
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, events: byDay.get(day) ?? [] });
  }

  return (
    <div className="embed-root min-h-full bg-[#1b1612] text-[#f4ece4]">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <header className="mb-6 flex flex-col gap-1 border-b border-[#5c2a22] pb-4">
          <FlobamaLogo className="mb-2 w-[200px]" />
          <p className="text-xs tracking-[0.28em] text-[#d4573c] uppercase">FloBama Music Hall</p>
          <h1 className="text-3xl font-semibold tracking-tight">Featured events</h1>
          <p className="text-sm text-[#c9b8aa]">{monthStart.toFormat("LLLL yyyy")} · Downtown Florence</p>
        </header>

        {events.length === 0 ? (
          <p className="rounded-xl border border-[#3a2f28] bg-[#241e19] px-4 py-10 text-center text-sm text-[#c9b8aa]">
            No upcoming public shows are listed right now.
          </p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <ol className="space-y-3">
              {events.map((event) => (
                <li key={event.id} className="rounded-xl border border-[#3a2f28] bg-[#241e19] px-4 py-3">
                  <p className="text-xs tracking-wide text-[#d4573c] uppercase">{event.display}</p>
                  <p className="mt-1 text-lg font-semibold">{event.name}</p>
                  {event.artists.length > 0 ? (
                    <p className="text-sm text-[#c9b8aa]">{event.artists.join(", ")}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                    {event.coverCharge ? <span className="text-[#c9b8aa]">Cover {event.coverCharge}</span> : null}
                    {event.ticketed && event.ticketUrl ? (
                      <a
                        className="font-medium text-[#f0a089] underline-offset-4 hover:underline"
                        href={event.ticketUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Tickets
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>

            <section aria-label="Month calendar" className="rounded-xl border border-[#3a2f28] bg-[#241e19] p-3">
              <p className="mb-3 text-sm font-medium">{monthStart.toFormat("LLLL yyyy")}</p>
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-[#c9b8aa]">
                {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => (
                  <div key={`${label}-${index}`} className="py-1">
                    {label}
                  </div>
                ))}
                {cells.map((cell, index) => (
                  <div
                    key={index}
                    className={`min-h-9 rounded-md py-1 ${
                      cell.day && cell.events.length > 0 ? "bg-[#5c2a22] text-[#f4ece4]" : "text-[#c9b8aa]"
                    }`}
                  >
                    {cell.day ?? ""}
                    {cell.events.length > 1 ? (
                      <span className="mt-0.5 block text-[10px] text-[#f0a089]">{cell.events.length}</span>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
