"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { BookingContactActions } from "@/components/booking/booking-contact-actions";
import { BandFitListBadges } from "@/components/booking/band-fit-badges";
import { BandPacketExportBar, BandPacketRowCheckbox } from "@/components/booking/band-packet-export";
import { contactSummary } from "@/components/booking/contact-summary";
import type { BandFitAnalysisResult } from "@/lib/booking/analyze-band";
import type { BookingRecord } from "@/lib/ghl/objects";
import { BOOKING_KIND_META } from "@/lib/ghl/objects";

function formatWhen(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function BandSubmissionsList({
  records,
  fitById,
}: {
  records: BookingRecord[];
  fitById?: Record<string, BandFitAnalysisResult>;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const href = BOOKING_KIND_META.band_submission.href;

  function toggle(id: string, checked: boolean) {
    setSelectedIds((current) => {
      if (checked) return current.includes(id) ? current : [...current, id];
      return current.filter((value) => value !== id);
    });
  }

  return (
    <div className="space-y-4">
      <BandPacketExportBar
        items={records.map((record) => ({
          id: record.id,
          displayName: record.displayName,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        }))}
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
      />
      <ul className="divide-y rounded-xl border bg-card">
        {records.map((record) => (
          <li key={record.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-1 gap-3">
              <div className="pt-1">
                <BandPacketRowCheckbox
                  label={record.displayName}
                  checked={selectedIds.includes(record.id)}
                  onCheckedChange={(checked) => toggle(record.id, checked)}
                />
              </div>
              <Link href={`${href}/${record.id}`} className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{record.displayName}</p>
                  <BandFitListBadges result={fitById?.[record.id]} />
                </div>
                <div className="mt-1 space-y-1 text-sm text-muted-foreground">
                  <p>
                    {[record.inquiry?.genre, record.inquiry?.homeCity].filter(Boolean).join(" · ") ||
                      "Genre and home city not listed"}
                  </p>
                  {(() => {
                    const summary = contactSummary(record);
                    return <p className={summary.tone === "error" ? "text-destructive" : undefined}>{summary.text}</p>;
                  })()}
                  {record.requestedDates ? <p>Available: {record.requestedDates}</p> : null}
                  <p>
                    Expected compensation:{" "}
                    <span className="font-medium text-foreground">{record.compensation || "Not listed"}</span>
                  </p>
                </div>
              </Link>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
              <div className="flex items-center gap-3">
                {record.status ? <Badge variant="secondary">{record.status}</Badge> : null}
                <span className="text-xs text-muted-foreground">{formatWhen(record.updatedAt)}</span>
              </div>
              <BookingContactActions email={record.email} phone={record.phone} bandName={record.displayName} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
