import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEventById } from "@/lib/queries/events";
import { eventSalesSummary, getEventTicketing, listTicketingOrders } from "@/lib/queries/ticketing";
import { EventPageHeader } from "@/components/events/event-page-header";
import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/ticketing/money";
import { formatVenueDateTime } from "@/lib/timezone";
import { TICKETING_SQL } from "@/lib/ticketing/constants";

export const dynamic = "force-dynamic";

export default async function EventSalesPage({ params }: { params: Promise<{ id: string }> }) {
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
      <div className="mx-auto max-w-5xl space-y-6">
        <EventPageHeader event={event} current="sales" />
        <ErrorState title="Ticketing schema missing" description={`Apply ${TICKETING_SQL} in the SQL editor.`} />
      </div>
    );
  }

  const [{ summary }, { orders }] = await Promise.all([
    eventSalesSummary(supabase, event.id),
    listTicketingOrders(supabase, context.venue.id, event.id),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <EventPageHeader event={event} current="sales" />
      {!settings?.enabled ? (
        <p className="text-sm text-muted-foreground">Ticketing is off. Enable it to track sales for this show.</p>
      ) : null}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Tickets sold" value={String(summary?.ticketsSold ?? 0)} />
        <Stat label="Tables sold" value={String(summary?.tablesSold ?? 0)} />
        <Stat label="Gross" value={formatCents(summary?.grossCents ?? 0)} />
        <Stat label="Net" value={formatCents(summary?.netCents ?? 0)} />
        <Stat label="Orders" value={String(summary?.orders ?? 0)} />
        <Stat label="Refunds" value={String(summary?.refunds ?? 0)} />
        <Stat label="Checked in" value={`${summary?.checkedIn ?? 0} / ${summary?.admissions ?? 0}`} />
        <Stat label="Remaining capacity" value={String(summary?.remainingCapacity ?? 0)} />
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" render={<Link href={`/ticketing/check-in/${event.id}`} />}>
          Open check-in
        </Button>
        <Button size="sm" variant="outline" render={<Link href={`/tickets/${event.id}`} />}>
          Public event page
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Order</th>
              <th className="px-3 py-2 font-medium">Customer</th>
              <th className="px-3 py-2 font-medium">Total</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">When</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-muted-foreground">
                  No orders for this show yet.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    <Link href={`/ticketing/orders/${order.id}`} className="font-medium underline-offset-4 hover:underline">
                      {order.order_number}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    {order.first_name} {order.last_name}
                  </td>
                  <td className="px-3 py-2">{formatCents(order.total_cents)}</td>
                  <td className="px-3 py-2 uppercase">{order.order_status}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {formatVenueDateTime(order.created_at, context.venue.timezone)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-semibold">{value}</dd>
    </div>
  );
}
