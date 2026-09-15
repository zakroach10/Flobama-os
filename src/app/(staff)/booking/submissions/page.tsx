import { BookingInbox } from "@/components/booking/booking-inbox";
import { analyzeBandFits } from "@/lib/booking/analyze-band";
import { loadBookingInbox } from "@/lib/ghl/booking";

export const dynamic = "force-dynamic";

export default async function BandSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const status = typeof params.status === "string" ? params.status : "all";
  const page = Number.parseInt(typeof params.page === "string" ? params.page : "1", 10) || 1;
  const result = await loadBookingInbox("band_submission", { query, status, page });

  if (!result.configured) {
    return <BookingInbox kind="band_submission" configured={false} records={[]} statusOptions={[]} query={query} status={status} />;
  }

  const fitById = await analyzeBandFits(result.records);

  return (
    <BookingInbox
      kind="band_submission"
      configured
      records={result.records}
      statusOptions={result.statusOptions}
      query={query}
      status={status}
      error={result.error}
      fitById={fitById}
    />
  );
}
