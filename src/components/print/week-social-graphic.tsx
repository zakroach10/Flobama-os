import {
  SOCIAL_POSTER,
  SOCIAL_POSTER_ASSETS,
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
  if (template.id === "ticket") {
    return <TicketSocialGraphic format={format} rows={rows} pageLabel={pageLabel} rangeLabel={rangeLabel} templateId={template.id} />;
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
      />
    );
  }
  return <PaperSocialGraphic format={format} rows={rows} pageLabel={pageLabel} templateId={template.id} />;
}

function PaperSocialGraphic({
  format,
  rows,
  pageLabel,
  templateId,
}: {
  format: WeekSocialFormat;
  rows: SocialPosterRow[];
  pageLabel: string | null;
  templateId: WeekSocialTemplateId;
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
          className={cn("flex min-h-0 flex-1", columns.length === 2 ? "flex-row" : "flex-col")}
          style={{
            paddingLeft: scale.padX,
            paddingRight: scale.padX,
            paddingTop: scale.listTop,
            paddingBottom: pageLabel ? 28 : 36,
            justifyContent: "center",
            gap: columns.length === 2 ? 32 : scale.gap,
          }}
        >
          {columns.map((column, index) => (
            <ul
              key={index}
              className="flex flex-1 flex-col justify-center items-center"
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

function StackSocialGraphic({
  format,
  rows,
  pageLabel,
  rangeLabel,
  templateId,
  theme,
}: {
  format: WeekSocialFormat;
  rows: SocialPosterRow[];
  pageLabel: string | null;
  rangeLabel?: string;
  templateId: WeekSocialTemplateId;
  theme: SocialStackTheme;
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
      <header className="relative flex shrink-0 flex-col" style={{ height: 360, backgroundColor: theme.header }}>
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
          className="flex min-h-0 flex-1 flex-col items-center text-center"
          style={{
            gap: 14,
            padding: "24px 56px 36px",
            justifyContent: "center",
          }}
        >
          {rows.map((row) => (
            <li key={row.id} style={{ width: "100%" }}>
              <p className="uppercase" style={{ color: theme.date, fontSize: theme.dateSize, lineHeight: 1.1 }}>
                <span>{row.lead}</span>
                <sup className="relative -top-1 font-normal" style={{ fontSize: Math.round(theme.dateSize * 0.55), marginLeft: 1 }}>
                  {row.ordinal}
                </sup>
                <span className="font-bold"> {row.time}</span>
              </p>
              <p className="font-bold uppercase" style={{ color: theme.name, fontSize: theme.nameSize, lineHeight: 1.02, marginTop: 4 }}>
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
}: {
  format: WeekSocialFormat;
  rows: SocialPosterRow[];
  pageLabel: string | null;
  rangeLabel?: string;
  templateId: WeekSocialTemplateId;
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
        className="flex shrink-0 flex-col items-center justify-center text-center"
        style={{ height: 360, backgroundColor: theme.header, padding: "0 48px" }}
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
        <ul className="flex min-h-0 flex-1 flex-col items-center text-center" style={{ gap: 16, padding: "24px 48px 36px", justifyContent: "center" }}>
          {rows.map((row) => (
            <li key={row.id} className="flex w-full flex-col items-center" style={{ gap: 8 }}>
              <p
                className="font-bold uppercase"
                style={{ backgroundColor: theme.chip, color: theme.chipText, fontSize: 28, lineHeight: 1.1, padding: "10px 22px" }}
              >
                {row.lead}
                <sup className="relative -top-1 font-normal" style={{ fontSize: 14, marginLeft: 1 }}>
                  {row.ordinal}
                </sup>
                <span> {row.time}</span>
              </p>
              <p className="font-bold uppercase" style={{ color: theme.name, fontSize: 58, lineHeight: 1.02 }}>
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
