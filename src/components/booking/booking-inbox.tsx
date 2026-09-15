import Link from "next/link";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { BookingContactActions } from "@/components/booking/booking-contact-actions";
import type { BookingKind, BookingRecord } from "@/lib/ghl/objects";
import { BOOKING_KIND_META } from "@/lib/ghl/objects";

function formatWhen(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function BookingInbox({
  kind,
  configured,
  records,
  statusOptions,
  query,
  status,
  error,
}: {
  kind: BookingKind;
  configured: boolean;
  records: BookingRecord[];
  statusOptions: string[];
  query: string;
  status: string;
  error?: string;
}) {
  const meta = BOOKING_KIND_META[kind];
  const bandList = kind === "band_submission";

  if (!configured) {
    return (
      <EmptyState
        title="GoHighLevel is not connected"
        description="Set GHL_PRIVATE_TOKEN and GHL_LOCATION_ID on the server (Vercel or .env.local) to load Band Submission and Private events records. The token never appears in the browser."
        actionHref="/settings"
        actionLabel="Open settings"
      />
    );
  }

  return (
    <div className="space-y-4">
      {error ? <ErrorState title="Could not load records" description={error} /> : null}
      <form className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-4" method="get">
        <Input
          name="q"
          defaultValue={query}
          placeholder={bandList ? "Search band, contact, or city" : "Search records"}
          className="md:col-span-2"
          aria-label="Search"
        />
        <select
          name="status"
          defaultValue={status || "all"}
          className="h-11 rounded-lg border border-input bg-transparent px-3 text-sm"
          aria-label="Status"
        >
          <option value="all">All statuses</option>
          {statusOptions.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <button type="submit" className="h-11 rounded-lg border border-input bg-background px-3 text-sm font-medium">
          Filter
        </button>
      </form>
      {records.length === 0 && !error ? (
        <EmptyState
          title={`No ${meta.plural.toLowerCase()}`}
          description="GoHighLevel is the source of truth. New submissions appear here after you refresh this page."
        />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {records.map((record) => (
            <li key={record.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
              <Link href={`${meta.href}/${record.id}`} className="min-w-0 flex-1">
                <p className="font-medium">{record.displayName}</p>
                {bandList ? (
                  <div className="mt-1 space-y-1 text-sm text-muted-foreground">
                    <p>
                      {[record.inquiry?.genre, record.inquiry?.homeCity].filter(Boolean).join(" · ") || "Genre and home city not listed"}
                    </p>
                    <p>
                      {[record.contactName, record.email, record.phone].filter(Boolean).join(" · ") || "No contact details"}
                    </p>
                    {record.requestedDates ? <p>Available: {record.requestedDates}</p> : null}
                    <p>
                      Expected compensation:{" "}
                      <span className="font-medium text-foreground">{record.compensation || "Not listed"}</span>
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {[record.email, record.phone, record.requestedDates].filter(Boolean).join(" · ") || "No contact fields"}
                  </p>
                )}
              </Link>
              <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                <div className="flex items-center gap-3">
                  {record.status ? <Badge variant="secondary">{record.status}</Badge> : null}
                  <span className="text-xs text-muted-foreground">{formatWhen(record.updatedAt)}</span>
                </div>
                {bandList ? (
                  <BookingContactActions email={record.email} phone={record.phone} bandName={record.displayName} />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
