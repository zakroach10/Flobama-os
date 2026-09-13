import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { TicketingSubnav } from "@/components/ticketing/ticketing-subnav";
import { listTicketedEvents } from "@/lib/queries/ticketing";
import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function CheckInIndexPage() {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/login");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/login");
  const { rows, error, missing } = await listTicketedEvents(supabase, context.venue.id);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Check-in</h1>
      <TicketingSubnav />
      {missing || error ? <ErrorState title="Could not load shows" description={error ?? "Apply the ticketing migration."} /> : null}
      <ul className="space-y-2">
        {(rows as Array<{ events?: { id: string; title: string } | { id: string; title: string }[] }>).map((row) => {
          const event = Array.isArray(row.events) ? row.events[0] : row.events;
          if (!event) return null;
          return (
            <li key={event.id}>
              <Button className="w-full justify-between" render={<Link href={`/ticketing/check-in/${event.id}`} />}>
                {event.title}
                <span>Open door</span>
              </Button>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-muted-foreground">
        Alias: <code>/admin/ticketing/check-in/[eventId]</code>. Demo door:{" "}
        <Link href="/ticketing/check-in/demo" className="underline">
          /ticketing/check-in/demo
        </Link>
      </p>
    </div>
  );
}
