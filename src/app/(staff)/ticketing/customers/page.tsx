import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { TicketingSubnav } from "@/components/ticketing/ticketing-subnav";
import { listCustomers } from "@/lib/queries/ticketing";
import { ErrorState } from "@/components/states";
import { formatCents } from "@/lib/ticketing/money";

export const dynamic = "force-dynamic";

export default async function TicketingCustomersPage() {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/login");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/login");
  const { customers, error, missing } = await listCustomers(supabase, context.venue.id);
  if (missing || error) return <ErrorState title="Could not load customers" description={error ?? "Apply the ticketing migration."} />;
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Customers</h1>
      <TicketingSubnav />
      <ul className="divide-y rounded-xl border bg-card text-sm">
        {customers.length === 0 ? <li className="px-4 py-8 text-muted-foreground">No ticket buyers yet.</li> : null}
        {customers.map((row) => (
          <li key={`${row.order_number}-${row.email}`} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:justify-between">
            <div>
              <p className="font-medium">
                {row.first_name} {row.last_name}
              </p>
              <p className="text-muted-foreground">{row.email}</p>
            </div>
            <p>
              {formatCents(row.total_cents)} · {row.order_number}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
