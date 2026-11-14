import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { canManageProgramming } from "@/lib/auth/permissions";
import { CustomerMigrationNotice } from "@/components/customer/customer-subnav";
import { MerchForm } from "@/components/customer/merch-form";
import { listMerchProducts } from "@/lib/queries/customer-admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ErrorState } from "@/components/states";

export const dynamic = "force-dynamic";

export default async function CustomerMerchPage() {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/login");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/login");
  const { products, error, missing } = await listMerchProducts(supabase, context.venue.id);
  const canEdit = canManageProgramming(context.role);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Prices are charged through Stripe test mode (`STRIPE_MERCH_SECRET_KEY`). Live keys are refused. Ticket checkout keeps using its own mock adapter and is not affected.
      </p>
      {missing ? <CustomerMigrationNotice /> : null}
      {error && !missing ? <ErrorState title="Could not load merch" description={error} /> : null}
      {canEdit && !missing ? (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold">Add product</h2>
          <MerchForm canEdit={canEdit} />
        </section>
      ) : null}
      <div className="space-y-4">
        {products.map((product) => (
          <section key={product.id} className="rounded-xl border bg-card p-5">
            <MerchForm product={product} canEdit={canEdit} />
          </section>
        ))}
      </div>
    </div>
  );
}
