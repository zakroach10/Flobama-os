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
    <article className="flyer-sheet mx-auto my-6 flex w-[8.5in] min-h-[11in] flex-col items-center bg-white px-10 py-9 text-center text-[#111] shadow-lg print:my-0 print:shadow-none">
      <header className="w-full border-b-[8px] border-[#d36b4a] pb-6">
        <p className="text-[15px] font-black tracking-[0.46em] uppercase">{venueName}</p>
        <h1 className="mt-2 font-serif text-[96px] leading-[0.82] font-black tracking-tight uppercase">This week</h1>
        <p className="mt-5 text-[30px] font-black tracking-[0.16em] text-[#d36b4a] uppercase">{rangeLabel}</p>
      </header>

      {empty ? (
        <p className="mt-20 max-w-[12ch] font-serif text-6xl leading-[0.88] font-black uppercase">
          No public shows this week.
        </p>
      ) : (
        <ul className="mt-8 flex w-full flex-1 flex-col justify-center gap-5">
          {days.map((day) => {
            const live = day.events.length > 0;
            return (
              <li key={day.dateKey} className="w-full">
                {live ? (
                  <div>
                    <p className="text-[22px] font-black tracking-[0.28em] text-[#d36b4a] uppercase">
                      {shortWeekday(day.weekday)} {day.dateLabel}
                    </p>
                    <ul className="mt-1.5 space-y-2">
                      {day.events.map((event) => (
                        <li key={event.id}>
                          <p className="text-[34px] leading-[0.95] font-black tracking-tight uppercase">{event.name}</p>
                          <p className="mt-1 text-[16px] font-extrabold tracking-[0.14em] uppercase">
                            {weekEventLineupMeta(event)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-[16px] font-extrabold tracking-[0.22em] text-[#b0b0b0] uppercase">
                    {shortWeekday(day.weekday)} {day.dateLabel} · No shows
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <footer className="mt-8 w-full border-t-[8px] border-[#111] pt-5 text-[14px] font-black tracking-[0.34em] uppercase">
        FloBama Music Hall · Downtown Florence
      </footer>
    </article>
  );
}

function shortWeekday(weekday: string) {
  return weekday.slice(0, 3);
}
