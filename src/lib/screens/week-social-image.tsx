import { weekEventLineupMeta, type WeekSlideDay } from "@/lib/screens/week";
import type { WeekSocialFormat } from "@/lib/screens/social";

const SCALE: Record<
  WeekSocialFormat["id"],
  { pad: number; logo: number; title: number; range: number; day: number; event: number; meta: number }
> = {
  "ig-square": { pad: 52, logo: 560, title: 72, range: 28, day: 22, event: 34, meta: 16 },
  "ig-portrait": { pad: 60, logo: 640, title: 80, range: 30, day: 24, event: 38, meta: 17 },
  story: { pad: 72, logo: 760, title: 96, range: 32, day: 28, event: 46, meta: 20 },
  landscape: { pad: 48, logo: 480, title: 64, range: 26, day: 20, event: 30, meta: 15 },
};

function Text({
  children,
  style,
}: {
  children: string;
  style?: React.CSSProperties;
}) {
  return <div style={{ display: "flex", ...style }}>{children}</div>;
}

export function WeekSocialOgGraphic({
  format,
  rangeLabel,
  days,
  pageLabel,
  logoSrc,
}: {
  format: WeekSocialFormat;
  rangeLabel: string;
  days: WeekSlideDay[];
  pageLabel: string | null;
  logoSrc: string | null;
}) {
  const scale = SCALE[format.id];
  const split = format.layout === "split";
  const empty = days.length === 0;

  return (
    <div
      style={{
        width: format.width,
        height: format.height,
        display: "flex",
        flexDirection: split ? "row" : "column",
        backgroundColor: "#1b1612",
        color: "#f4ebe3",
        padding: scale.pad,
        fontFamily: "Georgia, ui-serif, serif",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: split ? "flex-start" : "center",
          justifyContent: split ? "center" : "flex-start",
          width: split ? "38%" : "100%",
          borderRight: split ? "8px solid #d36b4a" : "0px solid #1b1612",
          borderBottom: split ? "0px solid #1b1612" : "8px solid #d36b4a",
          paddingRight: split ? 40 : 0,
          paddingBottom: split ? 0 : 28,
        }}
      >
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoSrc} alt="FloBama" width={scale.logo} height={Math.round((scale.logo * 488) / 1500)} />
        ) : (
          <Text style={{ fontSize: 54, fontWeight: 900, letterSpacing: -2 }}>FloBama</Text>
        )}
        <Text
          style={{
            marginTop: 16,
            fontSize: scale.title,
            fontWeight: 900,
            lineHeight: 0.85,
            textTransform: "uppercase",
          }}
        >
          This week
        </Text>
        <Text
          style={{
            marginTop: 16,
            fontSize: scale.range,
            fontWeight: 800,
            letterSpacing: 3,
            color: "#d36b4a",
            textTransform: "uppercase",
          }}
        >
          {rangeLabel}
        </Text>
        {split ? (
          <Text
            style={{
              marginTop: 28,
              paddingTop: 18,
              borderTop: "6px solid rgba(244,235,227,0.35)",
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: 3,
              textTransform: "uppercase",
            }}
          >
            FloBama Music Hall · Downtown Florence
          </Text>
        ) : null}
      </div>

      {empty ? (
        <Text
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            fontSize: 56,
            fontWeight: 900,
            textTransform: "uppercase",
            textAlign: "center",
          }}
        >
          No public shows this week.
        </Text>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: split ? "row" : "column",
            flexWrap: split ? "wrap" : "nowrap",
            flex: 1,
            justifyContent: "center",
            paddingLeft: split ? 48 : 0,
            marginTop: split ? 0 : 28,
          }}
        >
          {days.map((day) => (
            <div
              key={day.dateKey}
              style={{
                display: "flex",
                flexDirection: "column",
                width: split ? "50%" : "100%",
                alignItems: split ? "flex-start" : "center",
                marginBottom: 22,
              }}
            >
              <Text
                style={{
                  fontSize: scale.day,
                  fontWeight: 800,
                  letterSpacing: 4,
                  color: "#d36b4a",
                  textTransform: "uppercase",
                }}
              >
                {`${day.weekday.slice(0, 3)} ${day.dateLabel}`}
              </Text>
              {day.events.map((event) => (
                <div
                  key={event.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: split ? "flex-start" : "center",
                    marginTop: 8,
                  }}
                >
                  <Text
                    style={{
                      fontSize: scale.event,
                      fontWeight: 900,
                      lineHeight: 0.95,
                      textTransform: "uppercase",
                    }}
                  >
                    {event.name}
                  </Text>
                  <Text
                    style={{
                      marginTop: 4,
                      fontSize: scale.meta,
                      fontWeight: 700,
                      letterSpacing: 2,
                      textTransform: "uppercase",
                    }}
                  >
                    {weekEventLineupMeta(event)}
                  </Text>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {!split ? (
        <Text
          style={{
            marginTop: 24,
            paddingTop: 18,
            borderTop: "8px solid rgba(244,235,227,0.35)",
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: 4,
            textTransform: "uppercase",
            justifyContent: "center",
          }}
        >
          FloBama Music Hall · Downtown Florence
        </Text>
      ) : null}

      {pageLabel ? (
        <Text style={{ marginTop: 12, fontSize: 16, fontWeight: 800, letterSpacing: 3, color: "#c9b8aa", textTransform: "uppercase" }}>
          {pageLabel}
        </Text>
      ) : null}
    </div>
  );
}
