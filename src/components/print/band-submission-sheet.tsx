import { BAND_FIT_VERDICT_LABELS } from "@/components/booking/band-fit-badges";
import type { BandFitAnalysisResult } from "@/lib/booking/analyze-band";
import { BAND_INQUIRY_FIELDS } from "@/lib/ghl/band-inquiry";
import type { BookingRecord } from "@/lib/ghl/objects";

const SECTION_TITLES = {
  profile: "Band",
  booking: "Booking",
  links: "Links & press",
  about: "About",
  files: "Files",
} as const;

function formatWhen(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function truncate(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

export function BandSubmissionSheet({
  record,
  analysis,
  index,
  total,
}: {
  record: BookingRecord;
  analysis: BandFitAnalysisResult | undefined;
  index: number;
  total: number;
}) {
  const inquiry = record.inquiry;
  const knownKeys = new Set(BAND_INQUIRY_FIELDS.flatMap((field) => [field.key, ...(field.aliases ?? [])]));
  const extras = Object.entries(record.properties).filter(([key, value]) => {
    if (!value) return false;
    const segment = key.split(".").pop()?.toLowerCase() ?? key.toLowerCase();
    return !knownKeys.has(segment) && segment !== "artist_band_name";
  });

  return (
    <article className="band-packet-sheet box-border flex h-[11in] w-[8.5in] flex-col overflow-hidden bg-white px-4 py-3 text-[#1a1a1a]">
      <header className="flex items-start justify-between gap-3 border-b border-[#d8d8d8] pb-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.14em] text-[#666] uppercase">FloBama · Band submission packet</p>
          <h1 className="mt-0.5 truncate text-[22px] leading-tight font-bold">{record.displayName}</h1>
          <p className="mt-0.5 text-[11px] text-[#555]">
            {[inquiry?.genre, inquiry?.homeCity].filter(Boolean).join(" · ") || "Genre / city not listed"}
            {record.status ? ` · ${record.status}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right text-[10px] text-[#666]">
          <p>
            {index + 1} / {total}
          </p>
          <p>Updated {formatWhen(record.updatedAt)}</p>
        </div>
      </header>

      <section className="mt-2 rounded border border-[#e4e4e4] bg-[#fafafa] px-2.5 py-2">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-[12px] font-bold tracking-wide uppercase">AI booking fit</h2>
          {analysis?.configured && analysis.analysis ? (
            <p className="text-[11px] font-semibold">
              {BAND_FIT_VERDICT_LABELS[analysis.analysis.verdict]} · {analysis.analysis.score}/100
            </p>
          ) : null}
        </div>
        {!analysis || !analysis.configured ? (
          <p className="mt-1 text-[11px] text-[#666]">AI analysis is not configured on this server.</p>
        ) : !analysis.analysis ? (
          <p className="mt-1 text-[11px] text-[#8a1f1f]">{analysis.error || "Could not generate analysis."}</p>
        ) : (
          <div className="mt-1 space-y-1.5">
            <p className="text-[11px] leading-snug">{truncate(analysis.analysis.summary, 320)}</p>
            <div className="grid grid-cols-2 gap-2 text-[10px] leading-snug">
              <div>
                <p className="font-semibold">Strengths</p>
                {analysis.analysis.strengths.length === 0 ? (
                  <p className="text-[#666]">None listed</p>
                ) : (
                  <ul className="list-disc pl-3.5">
                    {analysis.analysis.strengths.slice(0, 4).map((item) => (
                      <li key={item}>{truncate(item, 120)}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="font-semibold">Risks</p>
                {analysis.analysis.risks.length === 0 ? (
                  <p className="text-[#666]">None listed</p>
                ) : (
                  <ul className="list-disc pl-3.5">
                    {analysis.analysis.risks.slice(0, 4).map((item) => (
                      <li key={item}>{truncate(item, 120)}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <dl className="grid grid-cols-5 gap-1.5 border-t border-[#e4e4e4] pt-1.5 text-[9px] leading-snug">
              <Signal term="Presence" value={analysis.analysis.signals.onlinePresence} />
              <Signal term="Following" value={analysis.analysis.signals.following} />
              <Signal term="Draw" value={analysis.analysis.signals.draw} />
              <Signal term="Pay" value={analysis.analysis.signals.compensation} />
              <Signal term="Local" value={analysis.analysis.signals.localFit} />
            </dl>
          </div>
        )}
      </section>

      <section className="mt-2">
        <h2 className="text-[11px] font-bold tracking-wide uppercase">Contact</h2>
        <dl className="mt-1 grid grid-cols-4 gap-x-3 gap-y-1 text-[10px]">
          <Detail term="Name" value={record.contactName} />
          <Detail term="Email" value={record.email} />
          <Detail term="Phone" value={record.phone} />
          <Detail term="Compensation" value={record.compensation} />
        </dl>
        {record.contactLinkStatus === "error" ? (
          <p className="mt-1 text-[10px] text-[#8a1f1f]">{record.contactLinkMessage || "Contact lookup failed"}</p>
        ) : null}
      </section>

      <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-hidden">
        {(Object.keys(SECTION_TITLES) as Array<keyof typeof SECTION_TITLES>).map((section) => {
          const fields =
            inquiry?.fields.filter((field) => field.section === section && field.key !== "artist_band_name") ?? [];
          if (fields.length === 0) return null;
          const about = section === "about";
          return (
            <section key={section}>
              <h2 className="text-[11px] font-bold tracking-wide uppercase">{SECTION_TITLES[section]}</h2>
              <dl className={`mt-1 grid gap-x-3 gap-y-1 text-[10px] ${about ? "grid-cols-1" : "grid-cols-2"}`}>
                {fields.map((field) => (
                  <Detail
                    key={field.key}
                    term={field.label}
                    value={about ? truncate(field.value, 420) : truncate(field.value, 160)}
                    wide={about}
                  />
                ))}
              </dl>
            </section>
          );
        })}
        {extras.length > 0 ? (
          <section>
            <h2 className="text-[11px] font-bold tracking-wide uppercase">Other GHL fields</h2>
            <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
              {extras.slice(0, 8).map(([key, value]) => (
                <Detail key={key} term={key} value={truncate(value ?? "", 140)} />
              ))}
            </dl>
          </section>
        ) : null}
      </div>

      <footer className="mt-auto border-t border-[#d8d8d8] pt-1.5 text-[9px] text-[#777]">
        Advisory AI note from Band Inquiry fields only · Not written back to GoHighLevel · Internal management packet
      </footer>
    </article>
  );
}

function Detail({ term, value, wide }: { term: string; value: string | null; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-full" : undefined}>
      <dt className="text-[9px] tracking-wide text-[#777] uppercase">{term}</dt>
      <dd className="break-words whitespace-pre-wrap">{value?.trim() || "—"}</dd>
    </div>
  );
}

function Signal({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="font-semibold tracking-wide text-[#666] uppercase">{term}</dt>
      <dd className="mt-0.5 break-words">{truncate(value, 90)}</dd>
    </div>
  );
}
