import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { canManageProgramming } from "@/lib/auth/permissions";
import { CustomerMigrationNotice } from "@/components/customer/customer-subnav";
import { MenuItemForm } from "@/components/customer/menu-item-form";
import { listMenuItems } from "@/lib/queries/customer-admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ErrorState } from "@/components/states";

export const dynamic = "force-dynamic";

export default async function CustomerMenuPage() {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/login");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/login");
  const { items, error, missing } = await listMenuItems(supabase, context.venue.id);
  const canEdit = canManageProgramming(context.role);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Tonight&apos;s specials still come from Screens. This list is the full menu in the customer app.
      </p>
      {missing ? <CustomerMigrationNotice /> : null}
      {error && !missing ? <ErrorState title="Could not load the menu" description={error} /> : null}
      {canEdit && !missing ? (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold">Add menu item</h2>
          <MenuItemForm canEdit={canEdit} />
        </section>
      ) : null}
      <div className="space-y-4">
        {items.map((item) => (
          <section key={item.id} className="rounded-xl border bg-card p-5">
            <p className="mb-3 text-sm text-muted-foreground">{item.available ? "In the app" : "Hidden"}</p>
            <MenuItemForm item={item} canEdit={canEdit} />
          </section>
        ))}
      </div>
    </div>
  );
}
