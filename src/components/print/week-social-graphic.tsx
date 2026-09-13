import { FlobamaLogo } from "@/components/brand/flobama-logo";
import { weekEventLineupMeta, type WeekSlideDay } from "@/lib/screens/week";
import type { WeekSocialFormat } from "@/lib/screens/social";
import { cn } from "@/lib/utils";

const STACK: Record<
  WeekSocialFormat["id"],
  { pad: string; logo: string; title: string; range: string; day: string; event: string; meta: string; gap: string; footer: string }
> = {
  "ig-square": {
    pad: "px-[56px] py-[48px]",
    logo: "w-[620px]",
    title: "mt-3 font-serif text-[78px] leading-[0.82]",
    range: "mt-4 text-[28px]",
    day: "text-[22px]",
    event: "text-[36px]",
    meta: "mt-1 text-[16px]",
    gap: "mt-6 gap-5",
    footer: "mt-6 pt-4 text-[14px]",
  },
  "ig-portrait": {
    pad: "px-[64px] py-[56px]",
    logo: "w-[700px]",
    title: "mt-4 font-serif text-[88px] leading-[0.82]",
    range: "mt-5 text-[30px]",
    day: "text-[24px]",
    event: "text-[40px]",
    meta: "mt-1 text-[17px]",
    gap: "mt-8 gap-6",
    footer: "mt-8 pt-5 text-[15px]",
  },
  story: {
    pad: "px-[72px] py-[80px]",
    logo: "w-[820px]",
    title: "mt-8 font-serif text-[110px] leading-[0.82]",
    range: "mt-6 text-[34px]",
    day: "text-[30px]",
    event: "text-[52px]",
    meta: "mt-2 text-[22px]",
    gap: "mt-10 gap-8",
    footer: "mt-10 pt-7 text-[18px]",
  },
  landscape: {
    pad: "px-[56px] py-[48px]",
    logo: "w-[520px]",
    title: "mt-4 font-serif text-[72px] leading-[0.82]",
    range: "mt-4 text-[26px]",
    day: "text-[20px]",
    event: "text-[32px]",
    meta: "mt-1 text-[15px]",
    gap: "gap-5",
    footer: "mt-8 pt-5 text-[14px]",
  },
};

export function WeekSocialGraphic({
  format,
  rangeLabel,
  days,
  pageLabel = null,
}: {
  format: WeekSocialFormat;
  rangeLabel: string;
  days: WeekSlideDay[];
  pageLabel?: string | null;
}) {
  const style = STACK[format.id];
  const empty = days.length === 0;
  const split = format.layout === "split";

  return (
    <div
      className={cn("flex overflow-hidden bg-[#1b1612] text-center text-[#f4ebe3]", split ? "flex-row" : "flex-col items-center", style.pad)}
      style={{ width: format.width, height: format.height }}
    >
      <header
        className={cn(
          "flex flex-col items-center border-[#d36b4a]",
          split ? "w-[38%] shrink-0 justify-center border-r-[8px] pr-10 text-left" : "w-full border-b-[8px] pb-6",
        )}
      >
        <FlobamaLogo className={style.logo} priority />
        <h1 className={cn("font-black tracking-tight uppercase", style.title, split && "self-start")}>This week</h1>
        <p className={cn("font-black tracking-[0.16em] text-[#d36b4a] uppercase", style.range, split && "self-start")}>
          {rangeLabel}
        </p>
        {split ? (
          <p className={cn("w-full border-[#f4ebe3]/35 font-black tracking-[0.28em] uppercase", style.footer, "self-start border-t-[6px]")}>
            FloBama Music Hall · Downtown Florence
          </p>
        ) : null}
      </header>

      {empty ? (
        <p className="mt-16 max-w-[12ch] flex-1 self-center font-serif text-6xl leading-[0.88] font-black uppercase">
          No public shows this week.
        </p>
      ) : (
        <ul
          className={cn(
            "w-full flex-1",
            split ? "grid grid-cols-2 content-center pl-12" : "flex flex-col justify-center",
            style.gap,
          )}
        >
          {days.map((day) => (
            <li key={day.dateKey} className={split ? "text-left" : "w-full"}>
              <p className={cn("font-black tracking-[0.28em] text-[#d36b4a] uppercase", style.day)}>
                {day.weekday.slice(0, 3)} {day.dateLabel}
              </p>
              <ul className="mt-1.5 space-y-2">
                {day.events.map((event) => (
                  <li key={event.id}>
                    <p className={cn("leading-[0.95] font-black tracking-tight uppercase", style.event)}>{event.name}</p>
                    <p className={cn("font-extrabold tracking-[0.14em] uppercase", style.meta)}>{weekEventLineupMeta(event)}</p>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {!split ? (
        <footer className={cn("w-full border-t-[8px] border-[#f4ebe3]/35 font-black tracking-[0.34em] uppercase", style.footer)}>
          FloBama Music Hall · Downtown Florence
        </footer>
      ) : null}

      {pageLabel ? <p className="mt-4 font-black tracking-[0.2em] text-[#c9b8aa] uppercase">{pageLabel}</p> : null}
    </div>
  );
}
