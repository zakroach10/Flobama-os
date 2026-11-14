import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { canManageProgramming } from "@/lib/auth/permissions";
import { CustomerMigrationNotice } from "@/components/customer/customer-subnav";
import { OrdersTable } from "@/components/customer/orders-table";
import { listMerchOrders } from "@/lib/queries/customer-admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ErrorState } from "@/components/states";

export const dynamic = "force-dynamic";

export default async function CustomerOrdersPage() {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/login");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/login");
  const { orders, error, missing } = await listMerchOrders(supabase, context.venue.id);
  const canEdit = canManageProgramming(context.role);

  return (
    <div className="space-y-6">
      {missing ? <CustomerMigrationNotice /> : null}
      {error && !missing ? <ErrorState title="Could not load orders" description={error} /> : null}
      {!missing && !error ? <OrdersTable orders={orders} canEdit={canEdit} /> : null}
    </div>
  );
}
