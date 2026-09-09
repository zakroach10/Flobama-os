import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/staff";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDefaultVenueLayout, listLayoutObjects } from "@/lib/queries/ticketing";
import { TicketingSubnav } from "@/components/ticketing/ticketing-subnav";
import { LayoutEditor } from "@/components/ticketing/layout-editor";
import { ErrorState } from "@/components/states";
import { MASTER_LAYOUT_ID } from "@/lib/ticketing/constants";
import { demoTables, DEMO_DECOR } from "@/lib/ticketing/demo";

export const dynamic = "force-dynamic";

export default async function VenueLayoutPage() {
  const context = await getStaffContext();
  if (context.status !== "ok") redirect("/login");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/login");
  const { layout, error, missing } = await getDefaultVenueLayout(supabase, context.venue.id);
  if (missing) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">Venue layout</h1>
        <TicketingSubnav />
        <ErrorState
          title="Master layout is not in this database yet"
          description="Apply the ticketing migration to persist table coordinates. Demo positions are shown below and are not saved."
        />
        <LayoutEditor
          layoutId="demo"
          canvasWidth={1200}
          canvasHeight={860}
          objects={[
            ...DEMO_DECOR.map((item) => ({
              id: item.id,
              name: item.name,
              object_type: item.type,
              x_position: item.x,
              y_position: item.y,
              width: item.width,
              height: item.height,
              rotation: 0,
              capacity: 0,
              sellable: false,
              shape: "rect" as const,
            })),
            ...demoTables().map((table) => ({
              id: table.id,
              name: table.name,
              object_type: "table",
              x_position: table.x,
              y_position: table.y,
              width: table.width,
              height: table.height,
              capacity: table.capacity,
              sellable: true,
              shape: table.shape,
              table_number: table.tableNumber,
              status: table.status,
            })),
          ]}
          readOnly
        />
      </div>
    );
  }
  if (error || !layout) return <ErrorState title="Could not load layout" description={error ?? "No default layout."} />;
  const { objects } = await listLayoutObjects(supabase, layout.id);
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">{layout.name}</h1>
      <p className="text-muted-foreground">
        Master FloBama room. Add and edit tables, the bar, dividers, restrooms, and other spaces, then save. Event maps
        copy this layout and can still be changed per show.
      </p>
      <TicketingSubnav />
      <LayoutEditor
        layoutId={layout.id || MASTER_LAYOUT_ID}
        canvasWidth={layout.canvas_width}
        canvasHeight={layout.canvas_height}
        objects={objects.map((object) => ({
          id: object.id,
          name: object.name,
          object_type: object.object_type,
          x_position: object.x_position,
          y_position: object.y_position,
          width: object.width,
          height: object.height,
          rotation: object.rotation,
          capacity: object.capacity,
          sellable: object.sellable,
          shape: object.shape,
          table_number: object.table_number,
          section: object.section,
          default_price_cents: object.default_price_cents ?? null,
        }))}
      />
    </div>
  );
}
