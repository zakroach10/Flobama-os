import { notFound, redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEventById } from "@/lib/queries/events";
import { getEventTicketing, listTicketTypes } from "@/lib/queries/ticketing";
import { EventPageHeader } from "@/components/events/event-page-header";
import { TicketingSettingsForm } from "@/components/ticketing/ticketing-settings-form";
import { ErrorState } from "@/components/states";
import { canManageProgramming } from "@/lib/auth/permissions";
import { TICKETING_SQL } from "@/lib/ticketing/constants";

export const dynamic = "force-dynamic";

export default async function EventTicketingPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/login");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/login");
  const { id } = await params;
  const { event, error } = await getEventById(supabase, id);
  if (error) return <ErrorState title="Could not load event" description={error} />;
  if (!event || event.venue_id !== context.venue.id) notFound();

  const { settings, missing, error: settingsError } = await getEventTicketing(supabase, event.id);
  if (missing) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <EventPageHeader event={event} current="ticketing" />
        <ErrorState
          title="Ticketing tables are not on this database yet"
          description={`Apply ${TICKETING_SQL} in the SQL editor, then reload. Preview the public buyer flow at /tickets/demo.`}
        />
      </div>
    );
  }
  if (settingsError) return <ErrorState title="Could not load ticketing" description={settingsError} />;
  const { types } = await listTicketTypes(supabase, event.id);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <EventPageHeader event={event} current="ticketing" />
      <TicketingSettingsForm
        eventId={event.id}
        timezone={context.venue.timezone}
        settings={settings}
        types={types}
        canEdit={canManageProgramming(context.role)}
      />
    </div>
  );
}
