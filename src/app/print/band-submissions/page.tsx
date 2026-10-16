import type { Metadata } from "next";
import { BandPacketDocument } from "@/components/print/band-packet-document";
import { BandPacketToolbar } from "@/components/print/band-packet-toolbar";
import { EmptyState, ErrorState } from "@/components/states";
import { requireStaffMenu } from "@/lib/auth/require-menu";
import { analyzeBandFits } from "@/lib/booking/analyze-band";
import {
  bandPacketFileName,
  bandPacketTitle,
  filterRecordsForPacket,
  formatPacketMonthLabel,
  parseBandPacketSelection,
} from "@/lib/booking/packet";
import { demoBandPacketFitById, demoBandPacketRecords } from "@/lib/booking/packet-demo";
import { loadAllBookingRecords } from "@/lib/ghl/booking";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const metadata: Metadata = {
  title: "Band submission packet",
  robots: { index: false, follow: false },
};

export default async function BandSubmissionsPacketPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const autoPrint = params.print === "1";
  const demo = process.env.NODE_ENV !== "production" && params.demo === "1";

  if (!demo) {
    await requireStaffMenu("booking");
  }

  if (demo) {
    const records = demoBandPacketRecords();
    const fitById = demoBandPacketFitById();
    return (
      <>
        <BandPacketToolbar
          autoPrint={autoPrint}
          documentTitle="flobama-band-packet-demo"
          count={records.length}
          subtitle="Demo packet"
        />
        <BandPacketDocument records={records} fitById={fitById} />
        <span className="sr-only">Band submissions · demo · {records.length}</span>
      </>
    );
  }

  const selection = parseBandPacketSelection({
    scope: typeof params.scope === "string" ? params.scope : null,
    month: typeof params.month === "string" ? params.month : null,
    ids: typeof params.ids === "string" ? params.ids : null,
  });

  if ("error" in selection) {
    return (
      <>
        <BandPacketToolbar autoPrint={false} documentTitle="band-packet" count={0} subtitle="Invalid selection" />
        <div className="mx-auto max-w-xl px-4 py-10">
          <ErrorState title="Could not build packet" description={selection.error} />
        </div>
      </>
    );
  }

  const result = await loadAllBookingRecords("band_submission");
  if (!result.configured) {
    return (
      <>
        <BandPacketToolbar autoPrint={false} documentTitle="band-packet" count={0} subtitle="Not connected" />
        <div className="mx-auto max-w-xl px-4 py-10">
          <EmptyState
            title="GoHighLevel is not connected"
            description="Set GHL_PRIVATE_TOKEN and GHL_LOCATION_ID to export band submission packets."
            actionHref="/settings"
            actionLabel="Open settings"
          />
        </div>
      </>
    );
  }

  if (result.error) {
    return (
      <>
        <BandPacketToolbar autoPrint={false} documentTitle="band-packet" count={0} subtitle="Load failed" />
        <div className="mx-auto max-w-xl px-4 py-10">
          <ErrorState title="Could not load submissions" description={result.error} />
        </div>
      </>
    );
  }

  const records = filterRecordsForPacket(result.records, selection);
  const fitById = records.length > 0 ? await analyzeBandFits(records) : {};
  const title = bandPacketTitle(selection, records.length);
  const fileName = bandPacketFileName(selection, records.length).replace(/\.pdf$/i, "");
  const subtitle =
    selection.scope === "month"
      ? formatPacketMonthLabel(selection.month)
      : selection.scope === "selected"
        ? "Selected submissions"
        : "All submissions";

  return (
    <>
      <BandPacketToolbar autoPrint={autoPrint} documentTitle={fileName} count={records.length} subtitle={subtitle} />
      <BandPacketDocument records={records} fitById={fitById} />
      <span className="sr-only">{title}</span>
    </>
  );
}
