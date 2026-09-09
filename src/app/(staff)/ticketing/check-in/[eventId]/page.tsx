import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEventById } from "@/lib/queries/events";
import { CheckInDesk } from "@/components/ticketing/check-in-desk";
import { ErrorState } from "@/components/states";
import { DEMO_TICKET_EVENT, isDemoTicketingEvent } from "@/lib/ticketing/demo";

export const dynamic = "force-dynamic";

export default async function EventCheckInPage({ params }: { params: Promise<{ eventId: string }> }) {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/login");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/login");
  const { eventId } = await params;
  if (isDemoTicketingEvent(eventId)) {
    return <CheckInDesk eventId="demo-ticketing-event" eventTitle={`${DEMO_TICKET_EVENT.title} (demo)`} />;
  }
  const { event, error } = await getEventById(supabase, eventId);
  if (error) return <ErrorState title="Could not load event" description={error} />;
  return <CheckInDesk eventId={eventId} eventTitle={event?.title ?? "Show"} />;
}
