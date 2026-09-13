import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { TicketingSubnav } from "@/components/ticketing/ticketing-subnav";
import { listTicketingOrders, listTicketedEvents } from "@/lib/queries/ticketing";
import { ErrorState } from "@/components/states";
import { formatCents } from "@/lib/ticketing/money";

export const dynamic = "force-dynamic";

export default async function TicketingReportsPage() {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/login");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/login");
  const [{ orders, error, missing }, ticketed] = await Promise.all([
    listTicketingOrders(supabase, context.venue.id),
    listTicketedEvents(supabase, context.venue.id),
  ]);
  if (missing || error) return <ErrorState title="Could not load reports" description={error ?? "Apply the ticketing migration."} />;
  const paid = orders.filter((order) => order.order_status === "paid");
  const gross = paid.reduce((sum, order) => sum + order.total_cents, 0);
  const refunds = orders.filter((order) => order.order_status === "refunded");
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Reports</h1>
      <TicketingSubnav />
      <dl className="grid gap-3 sm:grid-cols-4">
        <Card label="Ticketed shows" value={String(ticketed.rows.length)} />
        <Card label="Paid orders" value={String(paid.length)} />
        <Card label="Gross" value={formatCents(gross)} />
        <Card label="Refunds" value={String(refunds.length)} />
      </dl>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold">{value}</dd>
    </div>
  );
}
