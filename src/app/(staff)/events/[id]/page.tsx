import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEventById, artistNames } from "@/lib/queries/events";
import { formatVenueDateTime } from "@/lib/timezone";
import { canManageProgramming } from "@/lib/auth/permissions";
import { EventActions } from "@/components/events/event-actions";
import { StatusBadge, TypeBadge, VisibilityNote } from "@/components/status-badge";
import { ErrorState } from "@/components/states";
import { EVENT_VISIBILITY_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/login");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/login");
  const { id } = await params;
  const { event, error } = await getEventById(supabase, id);
  if (error) return <ErrorState title="Could not load event" description={error} />;
  if (!event || event.venue_id !== context.venue.id) notFound();

  const names = artistNames(event);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            <Link href="/events" className="underline-offset-4 hover:underline">
              Events
            </Link>
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">{event.title}</h1>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={event.status} />
            <TypeBadge type={event.event_type} />
            <VisibilityNote visibility={event.visibility} />
            {event.archived_at ? (
              <span className="rounded-md border px-2 py-0.5 text-xs">Archived</span>
            ) : null}
          </div>
        </div>
        <EventActions
          eventId={event.id}
          status={event.status}
          archived={Boolean(event.archived_at)}
          canEdit={canManageProgramming(context.role)}
        />
      </div>

      {event.archived_at ? (
        <p className="rounded-lg border bg-muted px-4 py-3 text-sm">This event is archived.</p>
      ) : null}

      <dl className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
        <Item label="Starts" value={formatVenueDateTime(event.starts_at, context.venue.timezone)} />
        <Item label="Ends" value={formatVenueDateTime(event.ends_at, context.venue.timezone)} />
        <Item label="Timezone" value={context.venue.timezone} />
        <Item label="Location" value={event.location_label || "—"} />
        <Item label="Artists" value={names.length ? names.join(", ") : "None attached"} />
        <Item label="Visibility" value={EVENT_VISIBILITY_LABELS[event.visibility]} />
        <Item label="Featured" value={event.featured ? "Yes" : "No"} />
      </dl>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Public description</h2>
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
          {event.public_description || "No public description."}
        </p>
      </section>
      <section className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <h2 className="text-lg font-semibold">Internal notes (staff-only)</h2>
        <p className="whitespace-pre-wrap text-sm">
          {event.internal_notes || "No internal notes."}
        </p>
      </section>
      <p className="text-sm text-muted-foreground">
        Published means the database status is published. The public website is not connected in this
        milestone.
      </p>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  );
}
