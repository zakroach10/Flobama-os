import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingRecordActions } from "@/components/booking/booking-record-actions";
import { BookingContactActions } from "@/components/booking/booking-contact-actions";
import { BandFitAnalysisPanel } from "@/components/booking/band-fit-analysis-panel";
import { EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { analyzeBandFit } from "@/lib/booking/analyze-band";
import { loadBookingDetail } from "@/lib/ghl/booking";
import { BAND_INQUIRY_FIELDS } from "@/lib/ghl/band-inquiry";
import { BOOKING_KIND_META, type BookingKind, type BookingRecord } from "@/lib/ghl/objects";

export const dynamic = "force-dynamic";

const SECTION_TITLES = {
  profile: "Band",
  booking: "Booking",
  links: "Links & press",
  about: "About",
  files: "Files",
} as const;

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
  const analysis = kind === "band_submission" ? await analyzeBandFit(record) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="outline" render={<Link href={meta.href} />}>
            Back to {meta.plural.toLowerCase()}
          </Button>
          <h2 className="mt-4 text-xl font-semibold tracking-tight">{record.displayName}</h2>
          <p className="text-sm text-muted-foreground">
            {kind === "band_submission"
              ? [record.inquiry?.genre, record.inquiry?.homeCity].filter(Boolean).join(" · ") || meta.title
              : meta.title}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {record.status ? <Badge variant="secondary">{record.status}</Badge> : null}
          <BookingContactActions email={record.email} phone={record.phone} bandName={record.displayName} />
          <Button variant="outline" render={<a href={result.openInGhl} target="_blank" rel="noopener noreferrer" />}>
            Open in GHL
          </Button>
        </div>
      </div>

      {analysis ? <BandFitAnalysisPanel result={analysis} /> : null}
      {kind === "band_submission" ? <BandInquiryDetail record={record} /> : <GenericBookingDetail record={record} />}
      <BookingRecordActions kind={kind} record={record} />
    </div>
  );
}

function GenericBookingDetail({ record }: { record: BookingRecord }) {
  const extras = Object.entries(record.properties).filter(([, value]) => value);
  return (
    <>
      <section className="rounded-xl border bg-card p-4">
        <h3 className="text-lg font-semibold">Contact</h3>
        {record.contactLinkStatus === "none" ? (
          <p className="mt-3 text-sm text-muted-foreground">No linked contact</p>
        ) : null}
        {record.contactLinkStatus === "error" ? (
          <p className="mt-3 text-sm text-destructive">{record.contactLinkMessage || "Contact lookup failed"}</p>
        ) : null}
        {record.contactLinkStatus === "linked" ? (
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <Detail term="Name" value={record.contactName} />
            <Detail term="Email" value={record.email} href={record.email ? `mailto:${record.email}` : null} />
            <Detail term="Phone" value={record.phone} href={record.phone ? `tel:${record.phone}` : null} />
            <Detail term="Requested dates" value={record.requestedDates} />
            <Detail term="Updated" value={record.updatedAt} />
          </dl>
        ) : (
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <Detail term="Requested dates" value={record.requestedDates} />
            <Detail term="Updated" value={record.updatedAt} />
          </dl>
        )}
      </section>
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
    </>
  );
}

function BandInquiryDetail({ record }: { record: BookingRecord }) {
  const inquiry = record.inquiry;
  const knownKeys = new Set(BAND_INQUIRY_FIELDS.flatMap((field) => [field.key, ...(field.aliases ?? [])]));
  const extras = Object.entries(record.properties).filter(([key, value]) => {
    if (!value) return false;
    const segment = key.split(".").pop()?.toLowerCase() ?? key.toLowerCase();
    return !knownKeys.has(segment) && segment !== "artist_band_name";
  });

  return (
    <>
      <section className="rounded-xl border bg-card p-4">
        <h3 className="text-lg font-semibold">Contact</h3>
        {record.contactLinkStatus === "none" ? (
          <p className="mt-3 text-sm text-muted-foreground">No linked contact</p>
        ) : null}
        {record.contactLinkStatus === "error" ? (
          <p className="mt-3 text-sm text-destructive">{record.contactLinkMessage || "Contact lookup failed"}</p>
        ) : null}
        {record.contactLinkStatus === "linked" ? (
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <Detail term="Name" value={record.contactName} />
            <Detail term="Email" value={record.email} href={record.email ? `mailto:${record.email}` : null} />
            <Detail term="Phone" value={record.phone} href={record.phone ? `tel:${record.phone}` : null} />
            <Detail term="Expected compensation" value={record.compensation} />
          </dl>
        ) : (
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <Detail term="Expected compensation" value={record.compensation} />
          </dl>
        )}
      </section>
      {(Object.keys(SECTION_TITLES) as Array<keyof typeof SECTION_TITLES>).map((section) => {
        const fields = inquiry?.fields.filter((field) => field.section === section && field.key !== "artist_band_name") ?? [];
        if (fields.length === 0) return null;
        return (
          <section key={section} className="space-y-3">
            <h3 className="text-lg font-semibold">{SECTION_TITLES[section]}</h3>
            <dl className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2">
              {fields.map((field) => (
                <Detail
                  key={field.key}
                  term={field.label}
                  value={field.value}
                  href={field.href}
                  wide={section === "about"}
                />
              ))}
            </dl>
          </section>
        );
      })}
      {extras.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold">Other GHL fields</h3>
          <dl className="grid gap-2 rounded-xl border bg-card p-4 text-sm">
            {extras.map(([key, value]) => (
              <div key={key} className="grid gap-1 sm:grid-cols-[12rem_1fr]">
                <dt className="font-mono text-xs text-muted-foreground">{key}</dt>
                <dd className="break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </>
  );
}

function Detail({
  term,
  value,
  href,
  wide,
}: {
  term: string;
  value: string | null;
  href?: string | null;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs tracking-wide text-muted-foreground uppercase">{term}</dt>
      <dd className="mt-1 text-sm break-words">
        {value && href ? (
          <a href={href} className="underline-offset-4 hover:underline" target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
            {value}
          </a>
        ) : (
          value || "—"
        )}
      </dd>
    </div>
  );
}
