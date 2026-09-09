import { weekEventLineupMeta, type WeekSlideDay } from "@/lib/screens/week";

export function WeekFlyer({
  venueName,
  rangeLabel,
  days,
}: {
  venueName: string;
  rangeLabel: string;
  days: WeekSlideDay[];
}) {
  const empty = days.every((day) => day.events.length === 0);

  return (
    <article className="flyer-sheet mx-auto my-6 w-[8.5in] min-h-[11in] bg-[#f7f1ea] px-12 py-10 text-[#2c221c] shadow-lg print:my-0 print:shadow-none">
      <header className="border-b-2 border-[#d36b4a] pb-6">
        <p className="text-xs font-medium tracking-[0.28em] text-[#8a6f5c] uppercase">{venueName}</p>
        <h1 className="mt-3 font-serif text-5xl leading-none">This week</h1>
        <p className="mt-3 text-xl text-[#6e5344]">{rangeLabel}</p>
      </header>

      {empty ? (
        <p className="mt-16 max-w-[18ch] font-serif text-3xl leading-tight text-[#8a6f5c]">
          No public shows this week.
        </p>
      ) : (
        <ul className="mt-8 space-y-5">
          {days.map((day) => (
            <li key={day.dateKey} className="grid grid-cols-[7.5rem_1fr] gap-4 border-b border-[#d8c8ba] pb-4 last:border-0">
              <div>
                <p className="text-sm font-semibold tracking-wide text-[#d36b4a] uppercase">{day.weekday}</p>
                <p className="text-sm text-[#8a6f5c]">{day.dateLabel}</p>
              </div>
              {day.events.length === 0 ? (
                <p className="self-center text-sm text-[#b09a8b]">No shows</p>
              ) : (
                <ul className="space-y-2">
                  {day.events.map((event) => (
                    <li key={event.id}>
                      <p className="text-lg leading-tight font-medium">{event.name}</p>
                      <p className="mt-0.5 text-sm text-[#6e5344]">{weekEventLineupMeta(event)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      <footer className="mt-10 text-xs tracking-wide text-[#8a6f5c] uppercase">
        FloBama Music Hall · Downtown Florence
      </footer>
    </article>
  );
}
