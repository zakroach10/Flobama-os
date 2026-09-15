import { BandFitScoreBadges } from "@/components/booking/band-fit-badges";
import type { BandFitAnalysisResult } from "@/lib/booking/analyze-band";

export function BandFitAnalysisPanel({ result }: { result: BandFitAnalysisResult }) {
  if (!result.configured) {
    return (
      <section className="rounded-xl border border-dashed bg-card p-4">
        <h3 className="text-lg font-semibold">Booking fit analysis</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          AI analysis is not configured. Set <code>OPENAI_API_KEY</code> on the server (Vercel env for this
          Production/Preview deployment), then redeploy, to generate an advisory booking-fit note from this Band Inquiry.
        </p>
      </section>
    );
  }

  if (!result.analysis) {
    return (
      <section className="rounded-xl border bg-card p-4">
        <h3 className="text-lg font-semibold">Booking fit analysis</h3>
        <p className="mt-2 text-sm text-destructive">{result.error || "Could not generate analysis."}</p>
        <p className="mt-2 text-xs text-muted-foreground">Staff advisory only — the rest of this submission still loads normally.</p>
      </section>
    );
  }

  const { analysis } = result;

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Booking fit analysis</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Staff advisory from GHL Band Inquiry fields only. Not a booking decision and not written back to GoHighLevel.
          </p>
        </div>
        <BandFitScoreBadges analysis={analysis} />
      </div>
      <p className="text-sm">{analysis.summary}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm font-medium">Strengths</p>
          {analysis.strengths.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">None listed</p>
          ) : (
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
              {analysis.strengths.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-sm font-medium">Risks</p>
          {analysis.risks.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">None listed</p>
          ) : (
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
              {analysis.risks.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <dl className="grid gap-3 border-t pt-4 text-sm sm:grid-cols-2">
        <Signal term="Online presence" value={analysis.signals.onlinePresence} />
        <Signal term="Following" value={analysis.signals.following} />
        <Signal term="Draw" value={analysis.signals.draw} />
        <Signal term="Compensation" value={analysis.signals.compensation} />
        <Signal term="Local fit" value={analysis.signals.localFit} />
      </dl>
    </section>
  );
}

function Signal({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="text-xs tracking-wide text-muted-foreground uppercase">{term}</dt>
      <dd className="mt-1">{value}</dd>
    </div>
  );
}
