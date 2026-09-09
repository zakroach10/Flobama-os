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
    <article className="flyer-sheet mx-auto my-6 flex w-[8.5in] min-h-[11in] flex-col bg-[#1b1612] px-10 py-9 text-[#f4ebe3] shadow-lg print:my-0 print:shadow-none">
      <header className="border-b-[6px] border-[#d36b4a] pb-6">
        <p className="text-[13px] font-bold tracking-[0.42em] text-[#e4c4b0] uppercase">{venueName}</p>
        <h1 className="mt-2 font-serif text-[80px] leading-none tracking-tight uppercase">This week</h1>
        <p className="mt-4 text-[26px] font-bold tracking-[0.14em] text-[#d36b4a] uppercase">{rangeLabel}</p>
      </header>

      {empty ? (
        <p className="mt-16 max-w-[10ch] font-serif text-6xl leading-[0.9] text-[#e4c4b0]">No public shows this week.</p>
      ) : (
        <ul className="mt-7 flex-1">
          {days.map((day) => {
            const live = day.events.length > 0;
            return (
              <li
                key={day.dateKey}
                className={`grid grid-cols-[6.25rem_1fr] gap-5 border-b border-[#f4ebe3]/15 py-3.5 last:border-0 ${
                  live ? "bg-[#2a221c]" : ""
                }`}
              >
                <div className={`pl-3 ${live ? "border-l-[6px] border-[#d36b4a]" : "border-l-[6px] border-transparent"}`}>
                  <p className="text-[28px] leading-none font-black tracking-tight uppercase">{shortWeekday(day.weekday)}</p>
                  <p className="mt-1 text-[15px] font-semibold text-[#c9b8aa] uppercase">{day.dateLabel}</p>
                </div>
                {live ? (
                  <ul className="space-y-2 pr-3">
                    {day.events.map((event) => (
                      <li key={event.id}>
                        <p className="text-[26px] leading-[1.05] font-extrabold tracking-tight uppercase">{event.name}</p>
                        <p className="mt-1 text-[15px] font-medium tracking-wide text-[#e4c4b0] uppercase">
                          {weekEventLineupMeta(event)}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="self-center text-[15px] font-semibold tracking-[0.18em] text-[#8a7466] uppercase">
                    No shows
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <footer className="mt-8 text-[13px] font-bold tracking-[0.32em] text-[#e4c4b0] uppercase">
        FloBama Music Hall · Downtown Florence
      </footer>
    </article>
  );
}

function shortWeekday(weekday: string) {
  return weekday.slice(0, 3);
}
