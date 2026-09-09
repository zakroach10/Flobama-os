import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { TicketingSubnav } from "@/components/ticketing/ticketing-subnav";
import { listTicketingOrders } from "@/lib/queries/ticketing";
import { ErrorState } from "@/components/states";
import { formatCents } from "@/lib/ticketing/money";
import { formatVenueDateTime } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export default async function TicketingOrdersPage() {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/login");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/login");
  const { orders, error, missing } = await listTicketingOrders(supabase, context.venue.id);
  if (missing || error) {
    return <ErrorState title="Could not load orders" description={error ?? "Apply the ticketing migration."} />;
  }
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Orders</h1>
      <TicketingSubnav />
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
                  No paid orders yet. Demo purchases live only in this server process at /tickets/demo.
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
                    <div className="text-xs text-muted-foreground">{order.email}</div>
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
