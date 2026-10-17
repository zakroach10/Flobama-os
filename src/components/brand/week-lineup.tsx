import { FlobamaLogo } from "@/components/brand/flobama-logo";
import { VERTICAL_FRAME_HEIGHT } from "@/lib/screens/frame";
import { liveWeekDays, weekEventLineupMeta, type WeekSlideDay } from "@/lib/screens/week";
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
  const liveDays = liveWeekDays(days);
  const empty = liveDays.length === 0;
  const kiosk = size === "kiosk";
  const dark = tone === "dark";

  return (
    <div
      className={cn(
        "flex w-full flex-col items-center text-center",
        kiosk ? "h-auto" : "h-full",
        dark ? "bg-[#1b1612] text-[#f4ebe3]" : "bg-white text-[#111]",
        kiosk ? "px-12 py-8" : "px-10 py-9",
      )}
      style={kiosk ? { minHeight: VERTICAL_FRAME_HEIGHT } : undefined}
    >
      <header
        className={cn(
          "flex w-full flex-col items-center",
          kiosk ? "border-b-4 pb-4" : "border-b-[8px] pb-6",
          "border-[#d36b4a]",
        )}
      >
        {kiosk ? null : <FlobamaLogo className="w-[520px]" priority />}
        <h1
          className={cn(
            "font-black tracking-tight uppercase",
            kiosk ? "font-serif text-[72px] leading-[0.85]" : "mt-2 font-serif text-[96px] leading-[0.82]",
          )}
        >
          This week
        </h1>
        <p
          className={cn(
            "font-black tracking-[0.16em] text-[#d36b4a] uppercase",
            kiosk ? "mt-3 text-[26px] leading-none" : "mt-5 text-[30px]",
          )}
        >
          {rangeLabel}
        </p>
      </header>

      {empty ? (
        <p
          className={cn(
            "max-w-[12ch] font-serif font-black uppercase",
            kiosk
              ? "flex flex-1 items-center justify-center text-[56px] leading-[0.88]"
              : "mt-20 text-6xl leading-[0.88]",
          )}
        >
          No public shows this week.
        </p>
      ) : (
        <ul className={cn("flex w-full flex-1 flex-col justify-center", kiosk ? "mt-5 gap-4 pb-4" : "mt-8 gap-6")}>
          {liveDays.map((day) => (
            <li key={day.dateKey} className="w-full">
              <p
                className={cn(
                  "font-black tracking-[0.22em] text-[#d36b4a] uppercase",
                  kiosk ? "text-[22px] leading-none" : "text-[22px]",
                )}
              >
                {shortWeekday(day.weekday)} {day.dateLabel}
              </p>
              <ul className={kiosk ? "mt-1.5 space-y-1" : "mt-1.5 space-y-2"}>
                {day.events.map((event) => (
                  <li key={event.id}>
                    <p
                      className={cn(
                        "leading-[0.95] font-black tracking-tight uppercase",
                        kiosk ? "text-[36px]" : "text-[38px]",
                      )}
                    >
                      {event.name}
                    </p>
                    <p
                      className={cn(
                        "font-extrabold tracking-[0.12em] uppercase",
                        kiosk ? "mt-0.5 text-[16px] leading-tight" : "mt-1 text-[16px]",
                      )}
                    >
                      {weekEventLineupMeta(event)}
                    </p>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {footer ? (
        <footer
          className={cn(
            "w-full font-black tracking-[0.34em] uppercase",
            kiosk ? "mt-auto border-t-4 pt-4 text-[16px] leading-none" : "mt-8 border-t-[8px] pt-5 text-[14px]",
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
