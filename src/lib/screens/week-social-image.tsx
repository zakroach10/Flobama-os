import {
  SOCIAL_POSTER,
  SOCIAL_TEMPLATE_HEADING,
  SOCIAL_TEMPLATE_LOGO,
  SOCIAL_TICKET_THEME,
  socialPosterColumns,
  socialPosterRows,
  socialPosterScale,
  socialPosterStackTheme,
  type SocialPosterRow,
  type SocialStackTheme,
} from "@/lib/screens/social-poster";
import { weekSocialTemplate, type WeekSocialFormat } from "@/lib/screens/social";
import type { WeekSlideDay } from "@/lib/screens/week";

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
  logoSrc = null,
  rangeLabel,
  templateId,
}: {
  format: WeekSocialFormat;
  rangeLabel?: string;
  days: WeekSlideDay[];
  pageLabel: string | null;
  paperSrc: string | null;
  tearSrc: string | null;
  stickerSrc: string | null;
  logoSrc?: string | null;
  templateId?: string | null;
}) {
  const template = weekSocialTemplate(templateId);
  const rows = socialPosterRows(days);
  if (template.id === "ticket") {
    return <OgTicket format={format} rows={rows} pageLabel={pageLabel} rangeLabel={rangeLabel} logoSrc={logoSrc} />;
  }
  const stack = socialPosterStackTheme(template.id);
  if (stack) {
    return <OgStack format={format} rows={rows} pageLabel={pageLabel} rangeLabel={rangeLabel} theme={stack} logoSrc={logoSrc} />;
  }
  const scale = socialPosterScale(format.id);
  const columns = socialPosterColumns(rows, scale.columns);
  const split = columns.length === 2;

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
          paddingTop: 18,
          paddingBottom: Math.round(scale.header * 0.18),
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
          <img src={stickerSrc} alt="FloBama" width={scale.logo} height={Math.round((scale.logo * 300) / 710)} />
        ) : (
          <Text style={{ fontSize: 54, fontWeight: 700, color: SOCIAL_POSTER.title }}>FloBama</Text>
        )}
        <Text
          style={{
            marginTop: Math.round(scale.title * 0.45),
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
            justifyContent: "center",
            alignItems: "center",
            paddingLeft: scale.padX,
            paddingRight: scale.padX,
            paddingTop: scale.listTop,
            paddingBottom: pageLabel ? 28 : 36,
            gap: split ? 32 : scale.gap,
          }}
        >
          {columns.map((column, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                justifyContent: "center",
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
                        marginLeft: 8,
                        textTransform: "uppercase",
                      }}
                    >
                      {row.time}
                    </Text>
                  </div>
                  <Text
                    style={{
                      marginTop: 2,
                      fontSize: scale.name,
                      fontWeight: 700,
                      color: SOCIAL_POSTER.blue,
                      textTransform: "uppercase",
                      textAlign: "center",
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

function OgStack({
  format,
  rows,
  pageLabel,
  rangeLabel,
  theme,
  logoSrc,
}: {
  format: WeekSocialFormat;
  rows: SocialPosterRow[];
  pageLabel: string | null;
  rangeLabel?: string;
  theme: SocialStackTheme;
  logoSrc: string | null;
}) {
  return (
    <div
      style={{
        width: format.width,
        height: format.height,
        display: "flex",
        flexDirection: "column",
        backgroundColor: theme.canvas,
        fontFamily: "Roboto",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: 360,
          backgroundColor: theme.header,
        }}
      >
        {theme.bar > 0 ? (
          <div style={{ display: "flex", height: theme.bar, width: "100%", backgroundColor: theme.rule }} />
        ) : null}
        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            paddingLeft: 48,
            paddingRight: 48,
            paddingBottom: 12,
          }}
        >
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoSrc} alt="FloBama" width={SOCIAL_TEMPLATE_LOGO.width} height={SOCIAL_TEMPLATE_LOGO.height} />
          ) : (
            <Text style={{ fontSize: 58, fontWeight: 700, color: theme.kicker }}>FloBama</Text>
          )}
          <Text
            style={{
              marginTop: 18,
              fontSize: 44,
              fontWeight: 700,
              letterSpacing: 2,
              color: theme.heading,
              textTransform: "uppercase",
            }}
          >
            {SOCIAL_TEMPLATE_HEADING}
          </Text>
          {rangeLabel ? (
            <Text
              style={{
                marginTop: 12,
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: 2,
                color: theme.range,
                textTransform: "uppercase",
              }}
            >
              {rangeLabel}
            </Text>
          ) : null}
        </div>
        <div style={{ display: "flex", height: 8, width: "100%", backgroundColor: theme.rule }} />
      </div>
      {rows.length === 0 ? (
        <Text
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            fontSize: 48,
            fontWeight: 700,
            color: theme.heading,
            textTransform: "uppercase",
            textAlign: "center",
            paddingLeft: 48,
            paddingRight: 48,
          }}
        >
          No public shows this week
        </Text>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingLeft: 56,
            paddingRight: 56,
            paddingTop: 24,
            paddingBottom: 36,
            gap: 14,
          }}
        >
          {rows.map((row) => (
            <div
              key={row.id}
              style={{
                display: "flex",
                flexDirection: "column",
                width: "100%",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-start" }}>
                <Text style={{ fontSize: theme.dateSize, color: theme.date, textTransform: "uppercase" }}>{row.lead}</Text>
                <Text style={{ fontSize: Math.round(theme.dateSize * 0.55), color: theme.date, marginTop: 2, textTransform: "uppercase" }}>{row.ordinal}</Text>
                <Text style={{ fontSize: theme.dateSize, fontWeight: 700, color: theme.date, marginLeft: 8, textTransform: "uppercase" }}>{row.time}</Text>
              </div>
              <Text
                style={{
                  marginTop: 2,
                  fontSize: theme.nameSize,
                  fontWeight: 700,
                  color: theme.name,
                  textTransform: "uppercase",
                  textAlign: "center",
                }}
              >
                {row.name}
              </Text>
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
            color: theme.muted,
            textTransform: "uppercase",
          }}
        >
          {pageLabel}
        </Text>
      ) : null}
    </div>
  );
}

function OgTicket({
  format,
  rows,
  pageLabel,
  rangeLabel,
  logoSrc,
}: {
  format: WeekSocialFormat;
  rows: SocialPosterRow[];
  pageLabel: string | null;
  rangeLabel?: string;
  logoSrc: string | null;
}) {
  const theme = SOCIAL_TICKET_THEME;
  return (
    <div
      style={{
        width: format.width,
        height: format.height,
        display: "flex",
        flexDirection: "column",
        backgroundColor: theme.canvas,
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
          height: 360,
          backgroundColor: theme.header,
          paddingLeft: 48,
          paddingRight: 48,
        }}
      >
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoSrc} alt="FloBama" width={SOCIAL_TEMPLATE_LOGO.width} height={SOCIAL_TEMPLATE_LOGO.height} />
        ) : (
          <Text style={{ fontSize: 48, fontWeight: 700, color: theme.kicker }}>FloBama</Text>
        )}
        <Text
          style={{
            marginTop: 14,
            fontSize: 40,
            fontWeight: 700,
            letterSpacing: 2,
            color: theme.heading,
            textTransform: "uppercase",
          }}
        >
          {SOCIAL_TEMPLATE_HEADING}
        </Text>
        {rangeLabel ? (
          <Text
            style={{
              marginTop: 10,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: 2,
              color: theme.range,
              textTransform: "uppercase",
            }}
          >
            {rangeLabel}
          </Text>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <Text
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            fontSize: 48,
            fontWeight: 700,
            color: theme.chip,
            textTransform: "uppercase",
            textAlign: "center",
            paddingLeft: 48,
            paddingRight: 48,
          }}
        >
          No public shows this week
        </Text>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingLeft: 48,
            paddingRight: 48,
            paddingTop: 24,
            paddingBottom: 36,
            gap: 16,
          }}
        >
          {rows.map((row) => (
            <div key={row.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "flex-start",
                  justifyContent: "center",
                  backgroundColor: theme.chip,
                  paddingTop: 10,
                  paddingBottom: 10,
                  paddingLeft: 22,
                  paddingRight: 22,
                }}
              >
                <Text style={{ fontSize: 28, fontWeight: 700, color: theme.chipText, textTransform: "uppercase" }}>{row.lead}</Text>
                <Text style={{ fontSize: 14, color: theme.chipText, marginTop: 2 }}>{row.ordinal}</Text>
                <Text style={{ fontSize: 28, fontWeight: 700, color: theme.chipText, marginLeft: 8 }}>{row.time}</Text>
              </div>
              <Text
                style={{
                  marginTop: 8,
                  fontSize: 58,
                  fontWeight: 700,
                  color: theme.name,
                  textTransform: "uppercase",
                  textAlign: "center",
                }}
              >
                {row.name}
              </Text>
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
            color: theme.muted,
            textTransform: "uppercase",
          }}
        >
          {pageLabel}
        </Text>
      ) : null}
    </div>
  );
}
