import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { TicketingSubnav } from "@/components/ticketing/ticketing-subnav";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/states";
import { eventSalesSummary, listTicketedEvents } from "@/lib/queries/ticketing";
import { TICKETING_SQL } from "@/lib/ticketing/constants";
import { formatCents } from "@/lib/ticketing/money";
import { formatVenueDateTime } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export default async function TicketingDashboardPage() {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/login");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/login");

  const { rows, error, missing } = await listTicketedEvents(supabase, context.venue.id);
  if (missing) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <Header />
        <ErrorState
          title="Ticketing tables are not on this database yet"
          description={`Apply ${TICKETING_SQL} in the SQL editor, then reload. Until then, preview the public flow at /tickets/demo.`}
        />
      </div>
    );
  }
  if (error) return <ErrorState title="Could not load ticketing" description={error} />;

  const cards = await Promise.all(
    rows.map(async (row) => {
      const event = row.events as { id: string; title: string; starts_at: string; status: string } | { id: string; title: string; starts_at: string; status: string }[] | null;
      const record = Array.isArray(event) ? event[0] : event;
      if (!record) return null;
      const { summary } = await eventSalesSummary(supabase, record.id);
      return { event: record, settings: row, summary };
    }),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Header />
      <TicketingSubnav />
      {cards.filter(Boolean).length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          No ticketed shows yet. Open an event and turn on Ticketing, or preview the public buyer flow at{" "}
          <Link href="/tickets/demo" className="underline">
            /tickets/demo
          </Link>
          .
        </p>
      ) : (
        <div className="space-y-4">
          {cards.map((card) => {
            if (!card) return null;
            const { event, summary } = card;
            return (
              <article key={event.id} className="rounded-xl border bg-card p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">{event.title}</h2>
                    <p className="text-sm text-muted-foreground">
                      {formatVenueDateTime(event.starts_at, context.venue.timezone)} · {event.status}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" render={<Link href={`/events/${event.id}/ticketing`} />}>
                      Manage tickets
                    </Button>
                    <Button size="sm" variant="outline" render={<Link href={`/ticketing/check-in/${event.id}`} />}>
                      Open check-in
                    </Button>
                    <Button size="sm" variant="ghost" render={<Link href={`/tickets/${event.id}`} />}>
                      Public page
                    </Button>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <Stat label="Tickets sold" value={String(summary?.ticketsSold ?? 0)} />
                  <Stat label="Tables sold" value={String(summary?.tablesSold ?? 0)} />
                  <Stat label="Gross" value={formatCents(summary?.grossCents ?? 0)} />
                  <Stat label="Net" value={formatCents(summary?.netCents ?? 0)} />
                  <Stat label="Orders" value={String(summary?.orders ?? 0)} />
                  <Stat label="Refunds" value={String(summary?.refunds ?? 0)} />
                  <Stat label="Checked in" value={`${summary?.checkedIn ?? 0} / ${summary?.admissions ?? 0}`} />
                  <Stat label="Remaining" value={String(summary?.remainingCapacity ?? 0)} />
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" render={<Link href={`/events/${event.id}/tables`} />}>
                    Manage tables
                  </Button>
                  <Button size="sm" variant="outline" render={<Link href={`/events/${event.id}/sales`} />}>
                    View orders
                  </Button>
                  <Button size="sm" variant="outline" render={<Link href={`/events/${event.id}/ticketing`} />}>
                    Ticketing settings
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Header() {
  return (
    <header>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Ticketing</h1>
      <p className="text-muted-foreground">Tickets, tables, door check-in, and sales for FloBama shows.</p>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}
