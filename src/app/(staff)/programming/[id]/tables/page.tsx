import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEventById } from "@/lib/queries/events";
import { getEventLayout, getEventTicketing, listEventLayoutObjects } from "@/lib/queries/ticketing";
import { EventPageHeader } from "@/components/events/event-page-header";
import { EventTableManager } from "@/components/ticketing/event-table-manager";
import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { canManageProgramming } from "@/lib/auth/permissions";
import { snapshotEventLayoutAction } from "@/actions/ticketing";
import { TICKETING_SQL } from "@/lib/ticketing/constants";

export const dynamic = "force-dynamic";

export default async function EventTablesPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/login");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/login");
  const { id } = await params;
  const { event, error } = await getEventById(supabase, id);
  if (error) return <ErrorState title="Could not load event" description={error} />;
  if (!event || event.venue_id !== context.venue.id) notFound();

  const { settings, missing } = await getEventTicketing(supabase, event.id);
  if (missing) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <EventPageHeader event={event} current="tables" />
        <ErrorState title="Ticketing schema missing" description={`Apply ${TICKETING_SQL} in the SQL editor.`} />
      </div>
    );
  }
  if (!settings?.enabled) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <EventPageHeader event={event} current="tables" />
        <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
          Enable ticketing on this event to copy the FloBama main room and edit tables for this show only.
        </p>
      </div>
    );
  }

  const { layout } = await getEventLayout(supabase, event.id);
  if (!layout) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <EventPageHeader event={event} current="tables" />
        <p className="text-sm text-muted-foreground">This show does not have its own table map yet.</p>
        {canManageProgramming(context.role) ? (
          <form
            action={async () => {
              "use server";
              await snapshotEventLayoutAction(event.id);
            }}
          >
            <Button type="submit">Copy master venue layout</Button>
          </form>
        ) : null}
      </div>
    );
  }

  const { objects } = await listEventLayoutObjects(supabase, event.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <EventPageHeader event={event} current="tables" />
      <p className="text-sm text-muted-foreground">
        Master layout lives under{" "}
        <Link href="/ticketing/layout" className="underline">
          Ticketing → Venue layout
        </Link>
        . Changes here stay on {event.title}.
      </p>
      <EventTableManager
        eventId={event.id}
        canvasWidth={layout.canvas_width}
        canvasHeight={layout.canvas_height}
        objects={objects}
        canEdit={canManageProgramming(context.role)}
      />
    </div>
  );
}
