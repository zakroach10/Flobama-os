import {
  SOCIAL_POSTER,
  SOCIAL_POSTER_ASSETS,
  SOCIAL_TEMPLATE_HEADING,
  SOCIAL_TEMPLATE_LOGO,
  SOCIAL_TICKET_THEME,
  socialLineupLayout,
  socialPosterColumns,
  socialPosterRows,
  socialPosterScale,
  socialPosterStackTheme,
  type SocialLineupLayout,
  type SocialPosterRow,
  type SocialStackTheme,
} from "@/lib/screens/social-poster";
import { FLOBAMA_LOGO_SRC } from "@/lib/brand";
import { weekSocialTemplate, type WeekSocialFormat, type WeekSocialTemplateId } from "@/lib/screens/social";
import type { WeekSlideDay } from "@/lib/screens/week";
import { cn } from "@/lib/utils";

export function WeekSocialGraphic({
  format,
  days,
  pageLabel = null,
  rangeLabel,
  templateId,
}: {
  format: WeekSocialFormat;
  rangeLabel?: string;
  days: WeekSlideDay[];
  pageLabel?: string | null;
  templateId?: string | null;
}) {
  const template = weekSocialTemplate(templateId);
  const rows = socialPosterRows(days);
  const layout = socialLineupLayout({
    templateId: template.id,
    names: rows.map((row) => row.name),
    width: format.width,
    height: format.height,
  });
  if (template.id === "ticket") {
    return (
      <TicketSocialGraphic
        format={format}
        rows={rows}
        pageLabel={pageLabel}
        rangeLabel={rangeLabel}
        templateId={template.id}
        layout={layout}
      />
    );
  }
  const stack = socialPosterStackTheme(template.id);
  if (stack) {
    return (
      <StackSocialGraphic
        format={format}
        rows={rows}
        pageLabel={pageLabel}
        rangeLabel={rangeLabel}
        templateId={template.id}
        theme={stack}
        layout={layout}
      />
    );
  }
  return <PaperSocialGraphic format={format} rows={rows} pageLabel={pageLabel} templateId={template.id} layout={layout} />;
}

function PaperSocialGraphic({
  format,
  rows,
  pageLabel,
  templateId,
  layout,
}: {
  format: WeekSocialFormat;
  rows: SocialPosterRow[];
  pageLabel: string | null;
  templateId: WeekSocialTemplateId;
  layout: SocialLineupLayout;
}) {
  const scale = socialPosterScale(format.id);
  const columns = socialPosterColumns(rows, scale.columns);

  return (
    <div
      className="relative flex flex-col overflow-hidden"
      data-social-template={templateId}
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
          className={cn("flex shrink-0 overflow-hidden", columns.length === 2 ? "flex-row" : "flex-col")}
          style={{
            height: layout.listHeight,
            paddingLeft: layout.padX,
            paddingRight: layout.padX,
            paddingTop: layout.padTop,
            paddingBottom: layout.padBottom,
            justifyContent: "center",
            alignItems: "center",
            gap: columns.length === 2 ? 32 : layout.gap,
          }}
        >
          {columns.map((column, index) => (
            <ul
              key={index}
              className="flex flex-col items-center justify-center"
              style={{ gap: layout.gap, width: "100%" }}
            >
              {column.map((row) => (
                <li key={row.id} className="w-full text-center">
                  <p
                    className="uppercase whitespace-nowrap"
                    style={{ color: SOCIAL_POSTER.ink, fontSize: layout.dateSize, lineHeight: layout.lineHeight }}
                  >
                    <span>{row.lead}</span>
                    <sup
                      className="relative -top-1 font-normal"
                      style={{ fontSize: layout.ordinalSize, marginLeft: 1 }}
                    >
                      {row.ordinal}
                    </sup>
                    <span className="font-bold"> {row.time}</span>
                  </p>
                  <p
                    className="font-bold uppercase"
                    style={{
                      color: SOCIAL_POSTER.blue,
                      fontSize: layout.nameSize,
                      lineHeight: layout.lineHeight,
                      marginTop: layout.nameGap,
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

function StackSocialGraphic({
  format,
  rows,
  pageLabel,
  rangeLabel,
  templateId,
  theme,
  layout,
}: {
  format: WeekSocialFormat;
  rows: SocialPosterRow[];
  pageLabel: string | null;
  rangeLabel?: string;
  templateId: WeekSocialTemplateId;
  theme: SocialStackTheme;
  layout: SocialLineupLayout;
}) {
  return (
    <div
      className="relative flex flex-col overflow-hidden"
      data-social-template={templateId}
      style={{
        width: format.width,
        height: format.height,
        backgroundColor: theme.canvas,
        fontFamily: "Roboto, Arial, sans-serif",
        color: theme.name,
      }}
    >
      <header className="relative z-10 flex shrink-0 flex-col overflow-hidden" style={{ height: layout.header, backgroundColor: theme.header }}>
        {theme.bar > 0 ? (
          <div style={{ height: theme.bar, backgroundColor: theme.rule }} />
        ) : null}
        <div
          className="flex flex-1 flex-col items-center justify-center text-center"
          style={{ padding: "0 48px 12px" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={FLOBAMA_LOGO_SRC}
            alt="FloBama"
            width={SOCIAL_TEMPLATE_LOGO.width}
            height={SOCIAL_TEMPLATE_LOGO.height}
            style={{ width: SOCIAL_TEMPLATE_LOGO.width, height: SOCIAL_TEMPLATE_LOGO.height }}
          />
          <h1
            className="font-bold tracking-[0.12em] uppercase"
            style={{ marginTop: 18, fontSize: 44, color: theme.heading, lineHeight: 1.05 }}
          >
            {SOCIAL_TEMPLATE_HEADING}
          </h1>
          {rangeLabel ? (
            <p className="font-bold tracking-[0.14em] uppercase" style={{ marginTop: 12, fontSize: 30, color: theme.range }}>
              {rangeLabel}
            </p>
          ) : null}
        </div>
        <div style={{ height: 8, backgroundColor: theme.rule }} />
      </header>
      {rows.length === 0 ? (
        <p
          className="flex flex-1 items-center justify-center px-12 text-center font-bold uppercase"
          style={{ color: theme.heading, fontSize: 48 }}
        >
          No public shows this week
        </p>
      ) : (
        <ul
          className="flex shrink-0 flex-col items-center overflow-hidden text-center"
          style={{
            height: layout.listHeight,
            gap: layout.gap,
            paddingTop: layout.padTop,
            paddingBottom: layout.padBottom,
            paddingLeft: layout.padX,
            paddingRight: layout.padX,
            justifyContent: "center",
          }}
        >
          {rows.map((row) => (
            <li key={row.id} style={{ width: "100%" }}>
              <p className="uppercase whitespace-nowrap" style={{ color: theme.date, fontSize: layout.dateSize, lineHeight: layout.lineHeight }}>
                <span>{row.lead}</span>
                <sup className="relative -top-1 font-normal" style={{ fontSize: layout.ordinalSize, marginLeft: 1 }}>
                  {row.ordinal}
                </sup>
                <span className="font-bold"> {row.time}</span>
              </p>
              <p className="font-bold uppercase" style={{ color: theme.name, fontSize: layout.nameSize, lineHeight: layout.lineHeight, marginTop: layout.nameGap }}>
                {row.name}
              </p>
            </li>
          ))}
        </ul>
      )}
      {pageLabel ? (
        <p className="absolute right-6 bottom-4 font-bold tracking-[0.18em] uppercase" style={{ color: theme.muted, fontSize: 16 }}>
          {pageLabel}
        </p>
      ) : null}
    </div>
  );
}

function TicketSocialGraphic({
  format,
  rows,
  pageLabel,
  rangeLabel,
  templateId,
  layout,
}: {
  format: WeekSocialFormat;
  rows: SocialPosterRow[];
  pageLabel: string | null;
  rangeLabel?: string;
  templateId: WeekSocialTemplateId;
  layout: SocialLineupLayout;
}) {
  const theme = SOCIAL_TICKET_THEME;
  return (
    <div
      className="relative flex flex-col overflow-hidden"
      data-social-template={templateId}
      style={{
        width: format.width,
        height: format.height,
        backgroundColor: theme.canvas,
        fontFamily: "Roboto, Arial, sans-serif",
      }}
    >
      <header
        className="relative z-10 flex shrink-0 flex-col items-center justify-center overflow-hidden text-center"
        style={{ height: layout.header, backgroundColor: theme.header, padding: "0 48px" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={FLOBAMA_LOGO_SRC}
          alt="FloBama"
          width={SOCIAL_TEMPLATE_LOGO.width}
          height={SOCIAL_TEMPLATE_LOGO.height}
          style={{ width: SOCIAL_TEMPLATE_LOGO.width, height: SOCIAL_TEMPLATE_LOGO.height }}
        />
        <h1 className="font-bold tracking-[0.12em] uppercase" style={{ marginTop: 14, fontSize: 40, color: theme.heading }}>
          {SOCIAL_TEMPLATE_HEADING}
        </h1>
        {rangeLabel ? (
          <p className="font-bold tracking-[0.14em] uppercase" style={{ marginTop: 10, fontSize: 28, color: theme.range }}>
            {rangeLabel}
          </p>
        ) : null}
      </header>
      {rows.length === 0 ? (
        <p className="flex flex-1 items-center justify-center px-12 text-center font-bold uppercase" style={{ color: theme.chip, fontSize: 48 }}>
          No public shows this week
        </p>
      ) : (
        <ul
          className="flex shrink-0 flex-col items-center overflow-hidden text-center"
          style={{
            height: layout.listHeight,
            gap: layout.gap,
            paddingTop: layout.padTop,
            paddingBottom: layout.padBottom,
            paddingLeft: layout.padX,
            paddingRight: layout.padX,
            justifyContent: "center",
          }}
        >
          {rows.map((row) => (
            <li key={row.id} className="flex w-full flex-col items-center" style={{ gap: layout.nameGap }}>
              <p
                className="font-bold uppercase whitespace-nowrap"
                style={{
                  backgroundColor: theme.chip,
                  color: theme.chipText,
                  fontSize: layout.chipFont,
                  lineHeight: layout.lineHeight,
                  padding: `${layout.chipPadY}px ${layout.chipPadX}px`,
                }}
              >
                {row.lead}
                <sup className="relative -top-1 font-normal" style={{ fontSize: layout.ordinalSize, marginLeft: 1 }}>
                  {row.ordinal}
                </sup>
                <span> {row.time}</span>
              </p>
              <p className="font-bold uppercase" style={{ color: theme.name, fontSize: layout.nameSize, lineHeight: layout.lineHeight }}>
                {row.name}
              </p>
            </li>
          ))}
        </ul>
      )}
      {pageLabel ? (
        <p className="absolute right-6 bottom-4 font-bold tracking-[0.18em] uppercase" style={{ color: theme.muted, fontSize: 16 }}>
          {pageLabel}
        </p>
      ) : null}
    </div>
  );
}
