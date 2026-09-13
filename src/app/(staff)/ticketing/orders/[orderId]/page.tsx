import { notFound, redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { canManageProgramming } from "@/lib/auth/permissions";
import { getTicketingOrder, listOrderItems, listOrderTickets } from "@/lib/queries/ticketing";
import { RefundOrderButton } from "@/components/ticketing/refund-button";
import { TicketingSubnav } from "@/components/ticketing/ticketing-subnav";
import { formatCents } from "@/lib/ticketing/money";
import { ErrorState } from "@/components/states";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/login");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/login");
  const { orderId } = await params;
  const { order, error } = await getTicketingOrder(supabase, orderId);
  if (error) return <ErrorState title="Could not load order" description={error} />;
  if (!order || order.venue_id !== context.venue.id) notFound();
  const [{ items }, { tickets }] = await Promise.all([listOrderItems(supabase, order.id), listOrderTickets(supabase, order.id)]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{order.order_number}</h1>
      <TicketingSubnav />
      <dl className="grid gap-3 rounded-xl border bg-card p-5 sm:grid-cols-2 text-sm">
        <div>
          <dt className="text-muted-foreground">Customer</dt>
          <dd>
            {order.first_name} {order.last_name}
            <div>{order.email}</div>
            <div>{order.phone || "No phone"}</div>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Payment</dt>
          <dd>
            {formatCents(order.total_cents)} · {order.payment_status} · {order.provider}
          </dd>
        </div>
      </dl>
      <section>
        <h2 className="mb-2 font-semibold">Items</h2>
        <ul className="divide-y rounded-xl border bg-card text-sm">
          {(items as Array<{ id: string; name: string; quantity: number; unit_price_cents: number; kind: string }>).map((item) => (
            <li key={item.id} className="flex justify-between px-4 py-2">
              <span>
                {item.quantity} × {item.name} ({item.kind})
              </span>
              <span>{formatCents(item.unit_price_cents * item.quantity)}</span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Tickets</h2>
        <ul className="divide-y rounded-xl border bg-card text-sm">
          {(tickets as Array<{ id: string; qr_token: string; status: string; admissions_checked_in: number; admissions_total: number }>).map((ticket) => (
            <li key={ticket.id} className="px-4 py-2">
              {ticket.status} · {ticket.admissions_checked_in}/{ticket.admissions_total} · token {ticket.qr_token.slice(0, 8)}…
            </li>
          ))}
        </ul>
      </section>
      {canManageProgramming(context.role) && order.order_status === "paid" ? (
        <RefundOrderButton orderId={order.id} />
      ) : null}
    </div>
  );
}
