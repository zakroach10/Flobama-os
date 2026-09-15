import { Badge } from "@/components/ui/badge";
import type { BandFitAnalysis, BandFitAnalysisResult, BandFitVerdict } from "@/lib/booking/analyze-band";

export const BAND_FIT_VERDICT_LABELS: Record<BandFitVerdict, string> = {
  strong_fit: "Strong fit",
  possible_fit: "Possible fit",
  weak_fit: "Weak fit",
  insufficient_data: "Insufficient data",
};

export function bandFitVerdictVariant(verdict: BandFitVerdict): "default" | "secondary" | "outline" | "destructive" {
  if (verdict === "strong_fit") return "default";
  if (verdict === "weak_fit") return "destructive";
  return "secondary";
}

export function BandFitScoreBadges({ analysis }: { analysis: BandFitAnalysis }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={bandFitVerdictVariant(analysis.verdict)}>{BAND_FIT_VERDICT_LABELS[analysis.verdict]}</Badge>
      <Badge variant="outline">{analysis.score}/100</Badge>
    </div>
  );
}

export function BandFitListBadges({ result }: { result: BandFitAnalysisResult | undefined }) {
  if (!result) return null;
  if (!result.configured) {
    return <span className="text-xs text-muted-foreground">AI not configured</span>;
  }
  if (!result.analysis) {
    return <span className="text-xs text-destructive">Fit unavailable</span>;
  }
  return <BandFitScoreBadges analysis={result.analysis} />;
}
