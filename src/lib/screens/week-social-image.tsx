import {
  SOCIAL_POSTER,
  socialPosterColumns,
  socialPosterListJustify,
  socialPosterRows,
  socialPosterScale,
} from "@/lib/screens/social-poster";
import type { WeekSocialFormat } from "@/lib/screens/social";
import type { WeekSlideDay } from "@/lib/screens/week";
import { flobamaLogoHeight } from "@/lib/brand";

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
  days,
  pageLabel,
  paperSrc,
  tearSrc,
  stickerSrc,
}: {
  format: WeekSocialFormat;
  rangeLabel?: string;
  days: WeekSlideDay[];
  pageLabel: string | null;
  paperSrc: string | null;
  tearSrc: string | null;
  stickerSrc: string | null;
}) {
  const scale = socialPosterScale(format.id, socialPosterRows(days).length);
  const rows = socialPosterRows(days);
  const columns = socialPosterColumns(rows, scale.columns);
  const split = columns.length === 2;
  const bottomPad = pageLabel ? Math.max(scale.padBottom, 28) : scale.padBottom;
  const listJustify = socialPosterListJustify(scale.listJustify);

  return (
    <div
      style={{
        width: format.width,
        height: format.height,
        display: "flex",
        flexDirection: "column",
        backgroundColor: SOCIAL_POSTER.cream,
        fontFamily: "Roboto",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: scale.header,
          position: "relative",
          overflow: "hidden",
          paddingTop: 12,
          paddingBottom: Math.round(scale.header * 0.14),
        }}
      >
        {paperSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={paperSrc}
            alt=""
            width={format.width}
            height={scale.header}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: format.width,
              height: scale.header,
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              display: "flex",
              position: "absolute",
              inset: 0,
              backgroundColor: "#ff6a00",
            }}
          />
        )}
        {stickerSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={stickerSrc} alt="FloBama" width={scale.logo} height={flobamaLogoHeight(scale.logo)} />
        ) : (
          <Text style={{ fontSize: 54, fontWeight: 700, color: SOCIAL_POSTER.title }}>FloBama</Text>
        )}
        <Text
          style={{
            marginTop: Math.round(scale.title * 0.35),
            fontSize: scale.title,
            fontWeight: 700,
            letterSpacing: 1,
            color: SOCIAL_POSTER.title,
            textTransform: "uppercase",
          }}
        >
          {SOCIAL_POSTER.heading}
        </Text>
        {tearSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tearSrc}
            alt=""
            width={format.width}
            height={Math.round(format.width * (58 / 1080))}
            style={{
              position: "absolute",
              left: 0,
              bottom: -Math.round(format.width * (58 / 1080) * 0.35),
              width: format.width,
            }}
          />
        ) : null}
      </div>

      {rows.length === 0 ? (
        <Text
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            fontSize: Math.round(scale.name * 1.15),
            fontWeight: 700,
            color: SOCIAL_POSTER.blue,
            textTransform: "uppercase",
            textAlign: "center",
            padding: scale.padX,
          }}
        >
          No public shows this week
        </Text>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: split ? "row" : "column",
            flex: 1,
            justifyContent: split ? "flex-start" : listJustify,
            paddingLeft: scale.padX,
            paddingRight: scale.padX,
            paddingTop: scale.listTop,
            paddingBottom: bottomPad,
            gap: split ? 28 : scale.gap,
          }}
        >
          {columns.map((column, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                justifyContent: listJustify,
                alignItems: "center",
                gap: scale.gap,
              }}
            >
              {column.map((row) => (
                <div
                  key={row.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    width: "100%",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "flex-start",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: scale.date,
                        color: SOCIAL_POSTER.ink,
                        textTransform: "uppercase",
                      }}
                    >
                      {row.lead}
                    </Text>
                    <Text
                      style={{
                        fontSize: scale.ordinal,
                        color: SOCIAL_POSTER.ink,
                        marginTop: 2,
                        textTransform: "uppercase",
                      }}
                    >
                      {row.ordinal}
                    </Text>
                    <Text
                      style={{
                        fontSize: scale.date,
                        fontWeight: 700,
                        color: SOCIAL_POSTER.ink,
                        textTransform: "uppercase",
                      }}
                    >
                      {` ${row.time}`}
                    </Text>
                  </div>
                  <Text
                    style={{
                      marginTop: 1,
                      fontSize: scale.name,
                      fontWeight: 700,
                      color: SOCIAL_POSTER.blue,
                      textTransform: "uppercase",
                      textAlign: "center",
                      lineHeight: 1.1,
                    }}
                  >
                    {row.name}
                  </Text>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {pageLabel ? (
        <Text
          style={{
            position: "absolute",
            right: 24,
            bottom: 16,
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: 3,
            color: "#666666",
            textTransform: "uppercase",
          }}
        >
          {pageLabel}
        </Text>
      ) : null}
    </div>
  );
}
