import { BandSubmissionSheet } from "@/components/print/band-submission-sheet";
import { LETTER_PREVIEW_HEIGHT, LETTER_PREVIEW_WIDTH, ScaledPreview } from "@/components/print/scaled-preview";
import type { BandFitAnalysisResult } from "@/lib/booking/analyze-band";
import type { BookingRecord } from "@/lib/ghl/objects";

export function BandPacketDocument({
  records,
  fitById,
}: {
  records: BookingRecord[];
  fitById: Record<string, BandFitAnalysisResult>;
}) {
  if (records.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold text-[#222]">No submissions in this packet</p>
        <p className="mt-2 text-sm text-[#555]">Change the selection or month and try again.</p>
      </div>
    );
  }

  return (
    <>
      <div className="no-print space-y-6 px-4 py-3 sm:py-4">
        {records.map((record, index) => (
          <div key={record.id}>
            <ScaledPreview
              width={LETTER_PREVIEW_WIDTH}
              height={LETTER_PREVIEW_HEIGHT}
              className="overflow-hidden rounded-sm shadow-lg"
            >
              <BandSubmissionSheet
                record={record}
                analysis={fitById[record.id]}
                index={index}
                total={records.length}
              />
            </ScaledPreview>
            <p className="mt-2 text-center text-xs text-[#5c534c]">
              Preview · {record.displayName} · page {index + 1} of {records.length}
            </p>
          </div>
        ))}
      </div>
      <div className="hidden print:block">
        {records.map((record, index) => (
          <BandSubmissionSheet
            key={record.id}
            record={record}
            analysis={fitById[record.id]}
            index={index}
            total={records.length}
          />
        ))}
      </div>
    </>
  );
}
