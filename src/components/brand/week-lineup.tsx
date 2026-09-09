import { FlobamaLogo } from "@/components/brand/flobama-logo";
import { weekEventLineupMeta, type WeekSlideDay } from "@/lib/screens/week";
import { cn } from "@/lib/utils";

export function WeekLineup({
  rangeLabel,
  days,
  tone,
  size = "flyer",
  footer = true,
  pageLabel = null,
}: {
  rangeLabel: string;
  days: WeekSlideDay[];
  tone: "light" | "dark";
  size?: "flyer" | "kiosk";
  footer?: boolean;
  pageLabel?: string | null;
}) {
  const empty = days.every((day) => day.events.length === 0);
  const kiosk = size === "kiosk";
  const dark = tone === "dark";

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center text-center",
        dark ? "bg-[#1b1612] text-[#f4ebe3]" : "bg-white text-[#111]",
        kiosk ? "px-16 py-16" : "px-10 py-9",
      )}
    >
      <header
        className={cn(
          "flex w-full flex-col items-center",
          kiosk ? "border-b-[10px] pb-10" : "border-b-[8px] pb-6",
          dark ? "border-[#d36b4a]" : "border-[#d36b4a]",
        )}
      >
        <FlobamaLogo className={kiosk ? "w-[760px]" : "w-[430px]"} priority />
        <h1
          className={cn(
            "font-black tracking-tight uppercase",
            kiosk ? "mt-8 font-serif text-[110px] leading-[0.82]" : "mt-2 font-serif text-[96px] leading-[0.82]",
          )}
        >
          This week
        </h1>
        <p
          className={cn(
            "font-black tracking-[0.16em] text-[#d36b4a] uppercase",
            kiosk ? "mt-6 text-[34px]" : "mt-5 text-[30px]",
          )}
        >
          {rangeLabel}
        </p>
      </header>

      {empty ? (
        <p
          className={cn(
            "max-w-[12ch] font-serif font-black uppercase",
            kiosk ? "mt-24 text-[72px] leading-[0.88]" : "mt-20 text-6xl leading-[0.88]",
          )}
        >
          No public shows this week.
        </p>
      ) : (
        <ul className={cn("flex w-full flex-1 flex-col justify-center", kiosk ? "mt-10 gap-7" : "mt-8 gap-5")}>
          {days.map((day) => {
            const live = day.events.length > 0;
            return (
              <li key={day.dateKey} className="w-full">
                {live ? (
                  <div>
                    <p
                      className={cn(
                        "font-black tracking-[0.28em] text-[#d36b4a] uppercase",
                        kiosk ? "text-[32px]" : "text-[22px]",
                      )}
                    >
                      {shortWeekday(day.weekday)} {day.dateLabel}
                    </p>
                    <ul className={kiosk ? "mt-2 space-y-3" : "mt-1.5 space-y-2"}>
                      {day.events.map((event) => (
                        <li key={event.id}>
                          <p
                            className={cn(
                              "leading-[0.95] font-black tracking-tight uppercase",
                              kiosk ? "text-[48px]" : "text-[34px]",
                            )}
                          >
                            {event.name}
                          </p>
                          <p
                            className={cn(
                              "font-extrabold tracking-[0.14em] uppercase",
                              kiosk ? "mt-2 text-[22px]" : "mt-1 text-[16px]",
                            )}
                          >
                            {weekEventLineupMeta(event)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p
                    className={cn(
                      "font-extrabold tracking-[0.22em] uppercase",
                      dark ? "text-[#6e5c52]" : "text-[#b0b0b0]",
                      kiosk ? "text-[22px]" : "text-[16px]",
                    )}
                  >
                    {shortWeekday(day.weekday)} {day.dateLabel} · No shows
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {footer ? (
        <footer
          className={cn(
            "w-full font-black tracking-[0.34em] uppercase",
            kiosk ? "mt-10 border-t-[10px] pt-7 text-[20px]" : "mt-8 border-t-[8px] pt-5 text-[14px]",
            dark ? "border-[#f4ebe3]/35" : "border-[#111]",
          )}
        >
          FloBama Music Hall · Downtown Florence
        </footer>
      ) : null}

      {pageLabel ? (
        <p className={cn("mt-6 font-black tracking-[0.2em] uppercase", dark ? "text-[#c9b8aa]" : "text-[#666]")}>
          {pageLabel}
        </p>
      ) : null}
    </div>
  );
}

function shortWeekday(weekday: string) {
  return weekday.slice(0, 3);
}
