import { BookingInbox } from "@/components/booking/booking-inbox";
import { loadBookingInbox } from "@/lib/ghl/booking";

export const dynamic = "force-dynamic";

export default async function PrivateEventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const status = typeof params.status === "string" ? params.status : "all";
  const page = Number.parseInt(typeof params.page === "string" ? params.page : "1", 10) || 1;
  const result = await loadBookingInbox("private_events", { query, status, page });

  if (!result.configured) {
    return <BookingInbox kind="private_events" configured={false} records={[]} statusOptions={[]} query={query} status={status} />;
  }

  return (
    <BookingInbox
      kind="private_events"
      configured
      records={result.records}
      statusOptions={result.statusOptions}
      query={query}
      status={status}
      error={result.error}
    />
  );
}
