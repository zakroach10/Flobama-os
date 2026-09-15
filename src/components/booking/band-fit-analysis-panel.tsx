import { Badge } from "@/components/ui/badge";
import type { BandFitAnalysisResult, BandFitVerdict } from "@/lib/booking/analyze-band";

const VERDICT_LABELS: Record<BandFitVerdict, string> = {
  strong_fit: "Strong fit",
  possible_fit: "Possible fit",
  weak_fit: "Weak fit",
  insufficient_data: "Insufficient data",
};

function verdictVariant(verdict: BandFitVerdict): "default" | "secondary" | "outline" | "destructive" {
  if (verdict === "strong_fit") return "default";
  if (verdict === "weak_fit") return "destructive";
  return "secondary";
}

export function BandFitAnalysisPanel({ result }: { result: BandFitAnalysisResult }) {
  if (!result.configured) {
    return (
      <section className="rounded-xl border border-dashed bg-card p-4">
        <h3 className="text-lg font-semibold">Booking fit analysis</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          AI analysis is not configured. Set <code>OPENAI_API_KEY</code> on the server to generate an advisory booking-fit
          note from this Band Inquiry.
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
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={verdictVariant(analysis.verdict)}>{VERDICT_LABELS[analysis.verdict]}</Badge>
          <Badge variant="outline">Score {analysis.score}/100</Badge>
        </div>
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
