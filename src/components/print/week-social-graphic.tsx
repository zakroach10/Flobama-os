import {
  SOCIAL_POSTER,
  SOCIAL_POSTER_ASSETS,
  socialPosterColumns,
  socialPosterRows,
  socialPosterScale,
} from "@/lib/screens/social-poster";
import type { WeekSocialFormat } from "@/lib/screens/social";
import type { WeekSlideDay } from "@/lib/screens/week";
import { cn } from "@/lib/utils";

export function WeekSocialGraphic({
  format,
  days,
  pageLabel = null,
}: {
  format: WeekSocialFormat;
  rangeLabel?: string;
  days: WeekSlideDay[];
  pageLabel?: string | null;
}) {
  const rows = socialPosterRows(days);
  const scale = socialPosterScale(format.id, rows.length);
  const columns = socialPosterColumns(rows, scale.columns);

  return (
    <div
      className="relative flex flex-col overflow-hidden"
      style={{
        width: format.width,
        height: format.height,
        backgroundColor: SOCIAL_POSTER.cream,
        fontFamily: "Roboto, Arial, sans-serif",
      }}
    >
      <header className="relative shrink-0 overflow-hidden" style={{ height: scale.header }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={SOCIAL_POSTER_ASSETS.paper}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
        <div
          className="relative z-10 flex h-full flex-col items-center justify-center"
          style={{ paddingTop: 18, paddingBottom: Math.round(scale.header * 0.18) }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={SOCIAL_POSTER_ASSETS.sticker}
            alt="FloBama"
            className="h-auto"
            style={{ width: scale.logo }}
          />
          <h1
            className="font-bold tracking-[0.02em] uppercase"
            style={{
              marginTop: Math.round(scale.title * 0.45),
              fontSize: scale.title,
              color: SOCIAL_POSTER.title,
              lineHeight: 1,
            }}
          >
            {SOCIAL_POSTER.heading}
          </h1>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={SOCIAL_POSTER_ASSETS.tear}
          alt=""
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 w-full translate-y-[35%]"
        />
      </header>

      {rows.length === 0 ? (
        <p
          className="flex flex-1 items-center justify-center text-center font-bold uppercase"
          style={{ color: SOCIAL_POSTER.blue, fontSize: scale.name * 1.15, padding: scale.padX }}
        >
          No public shows this week
        </p>
      ) : (
        <div
          className={cn("flex min-h-0 flex-1", columns.length === 2 ? "flex-row" : "flex-col")}
          style={{
            paddingLeft: scale.padX,
            paddingRight: scale.padX,
            paddingTop: scale.listTop,
            paddingBottom: pageLabel ? 28 : 36,
            justifyContent: "flex-start",
            gap: columns.length === 2 ? 32 : scale.gap,
          }}
        >
          {columns.map((column, index) => (
            <ul
              key={index}
              className="flex flex-1 flex-col justify-start"
              style={{ gap: scale.gap }}
            >
              {column.map((row) => (
                <li key={row.id} className="text-center">
                  <p
                    className="uppercase"
                    style={{ color: SOCIAL_POSTER.ink, fontSize: scale.date, lineHeight: 1.15 }}
                  >
                    <span>{row.lead}</span>
                    <sup
                      className="relative -top-1 font-normal"
                      style={{ fontSize: scale.ordinal, marginLeft: 1 }}
                    >
                      {row.ordinal}
                    </sup>
                    <span className="font-bold"> {row.time}</span>
                  </p>
                  <p
                    className="font-bold uppercase"
                    style={{
                      color: SOCIAL_POSTER.blue,
                      fontSize: scale.name,
                      lineHeight: 1.15,
                      marginTop: 2,
                    }}
                  >
                    {row.name}
                  </p>
                </li>
              ))}
            </ul>
          ))}
        </div>
      )}

      {pageLabel ? (
        <p
          className="absolute right-6 bottom-4 font-bold tracking-[0.18em] uppercase"
          style={{ color: "#666", fontSize: 16 }}
        >
          {pageLabel}
        </p>
      ) : null}
    </div>
  );
}
