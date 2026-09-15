import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingRecordActions } from "@/components/booking/booking-record-actions";
import { EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { loadBookingDetail } from "@/lib/ghl/booking";
import { BOOKING_KIND_META, type BookingKind } from "@/lib/ghl/objects";

export const dynamic = "force-dynamic";

export async function BookingRecordPage({
  kind,
  recordId,
}: {
  kind: BookingKind;
  recordId: string;
}) {
  const meta = BOOKING_KIND_META[kind];
  const result = await loadBookingDetail(kind, recordId);

  if (!result.configured) {
    return (
      <EmptyState
        title="GoHighLevel is not connected"
        description="Set the Private Integration environment variables to open this record."
        actionHref="/settings"
        actionLabel="Open settings"
      />
    );
  }

  if (!result.record) {
    if (result.error?.includes("not found")) notFound();
    return <ErrorState title="Could not load record" description={result.error} />;
  }

  const record = result.record;
  const extras = Object.entries(record.properties).filter(([, value]) => value);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="outline" render={<Link href={meta.href} />}>
            Back to {meta.plural.toLowerCase()}
          </Button>
          <h2 className="mt-4 text-xl font-semibold tracking-tight">{record.displayName}</h2>
          <p className="text-sm text-muted-foreground">{meta.title}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {record.status ? <Badge variant="secondary">{record.status}</Badge> : null}
          <Button variant="outline" render={<a href={result.openInGhl} target="_blank" rel="noopener noreferrer" />}>
            Open in GHL
          </Button>
        </div>
      </div>
      <dl className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2">
        <Detail term="Email" value={record.email} />
        <Detail term="Phone" value={record.phone} />
        <Detail term="Requested dates" value={record.requestedDates} />
        <Detail term="Updated" value={record.updatedAt} />
      </dl>
      <BookingRecordActions kind={kind} record={record} />
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">All GHL fields</h3>
        {extras.length === 0 ? (
          <p className="text-sm text-muted-foreground">No extra properties on this record.</p>
        ) : (
          <dl className="grid gap-2 rounded-xl border bg-card p-4 text-sm">
            {extras.map(([key, value]) => (
              <div key={key} className="grid gap-1 sm:grid-cols-[12rem_1fr]">
                <dt className="font-mono text-xs text-muted-foreground">{key}</dt>
                <dd className="break-words">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    </div>
  );
}

function Detail({ term, value }: { term: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs tracking-wide text-muted-foreground uppercase">{term}</dt>
      <dd className="mt-1 text-sm">{value || "—"}</dd>
    </div>
  );
}
