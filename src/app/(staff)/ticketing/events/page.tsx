import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { TicketingSubnav } from "@/components/ticketing/ticketing-subnav";
import { listTicketedEvents } from "@/lib/queries/ticketing";
import { ErrorState } from "@/components/states";
import { formatVenueDateTime } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export default async function TicketedEventsPage() {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/login");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/login");
  const { rows, error, missing } = await listTicketedEvents(supabase, context.venue.id);
  if (missing || error) {
    return <ErrorState title="Could not load ticketed events" description={error ?? "Apply the ticketing migration."} />;
  }
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Ticketed events</h1>
      <TicketingSubnav />
      <ul className="divide-y rounded-xl border bg-card">
        {rows.length === 0 ? <li className="px-4 py-8 text-sm text-muted-foreground">No shows have ticketing enabled.</li> : null}
        {rows.map((row) => {
          const event = (Array.isArray(row.events) ? row.events[0] : row.events) as
            | { id: string; title: string; starts_at: string; status: string }
            | undefined;
          if (!event) return null;
          return (
            <li key={event.id}>
              <Link href={`/events/${event.id}/ticketing`} className="flex min-h-12 items-center justify-between px-4 py-3">
                <span className="font-medium">{event.title}</span>
                <span className="text-sm text-muted-foreground">
                  {formatVenueDateTime(event.starts_at, context.venue.timezone)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
