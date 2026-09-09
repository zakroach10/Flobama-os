import { FLO_BAMA_VENUE_ID } from "@/lib/constants";
import { publicJson, publicOptions, PUBLIC_NO_STORE } from "@/lib/public/http";
import { createAnonSupabaseClient } from "@/lib/supabase/anon";
import { DEMO_TICKET_EVENT, DEMO_TICKET_EVENT_ID, DEMO_TICKET_TYPES, DEMO_DECOR } from "@/lib/ticketing/demo";
import { listDemoTables } from "@/lib/ticketing/memory-store";
import { isMissingTicketingSchema } from "@/lib/ticketing/errors";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return publicOptions();
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (id === DEMO_TICKET_EVENT_ID || id === "demo") {
    return publicJson(
      {
        event: DEMO_TICKET_EVENT,
        types: DEMO_TICKET_TYPES,
        tables: listDemoTables(),
        decor: DEMO_DECOR,
        demo: true,
      },
      200,
      PUBLIC_NO_STORE,
    );
  }

  const client = createAnonSupabaseClient();
  if (!client) return publicJson({ error: "Ticketing is not configured." }, 503, PUBLIC_NO_STORE);

  const { data: event, error } = await client.from("ticket_event_listings" as never).select("*").eq("id", id).maybeSingle();
  if (error) {
    if (isMissingTicketingSchema(error.message)) {
      return publicJson({ error: "Ticketing schema is not applied yet.", demo: "/tickets/demo" }, 404, PUBLIC_NO_STORE);
    }
    return publicJson({ error: error.message }, 500, PUBLIC_NO_STORE);
  }
  if (!event) return publicJson({ error: "Event not found." }, 404, PUBLIC_NO_STORE);

  const row = event as Record<string, unknown>;
  const [{ data: types }, { data: tables }, { data: layout }, { data: decor }] = await Promise.all([
    client.from("ticket_type_listings" as never).select("*").eq("event_id", id).order("sort_order"),
    client.from("event_table_listings" as never).select("*").eq("event_id", id),
    client.from("event_layout_public" as never).select("*").eq("event_id", id).maybeSingle(),
    client.from("event_layout_objects_public" as never).select("*").eq("event_id", id),
  ]);

  return publicJson(
    {
      event: {
        id: row.id,
        title: row.title,
        description: row.public_description,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        doorsAt: row.doors_at,
        locationLabel: row.location_label,
        tablesEnabled: row.tables_enabled,
        refundPolicy: row.refund_policy,
        ageRestriction: row.age_restriction,
        parkingNotes: row.parking_notes,
        venueNotes: row.venue_notes,
        holdMinutes: row.hold_minutes,
        maxTicketsPerOrder: row.max_tickets_per_order,
        canvasWidth: (layout as { canvas_width?: number } | null)?.canvas_width ?? 1200,
        canvasHeight: (layout as { canvas_height?: number } | null)?.canvas_height ?? 860,
        venueId: FLO_BAMA_VENUE_ID,
      },
      types: (types ?? []).map((item: Record<string, unknown>) => ({
        id: item.id,
        eventId: item.event_id,
        name: item.name,
        description: item.description,
        kind: item.kind,
        priceCents: item.price_cents,
        maxPerOrder: item.max_per_order,
        remaining: item.remaining,
        sortOrder: item.sort_order,
      })),
      tables: (tables ?? []).map((item: Record<string, unknown>) => ({
        id: item.id,
        eventId: item.event_id,
        name: item.name,
        tableNumber: item.table_number,
        section: item.section,
        capacity: item.capacity,
        priceCents: item.price_cents,
        vip: item.vip,
        x: item.x_position,
        y: item.y_position,
        width: item.width,
        height: item.height,
        rotation: item.rotation,
        shape: item.shape,
        objectType: item.object_type,
        status: item.status,
      })),
      demo: false,
      decor: ((decor ?? []) as Array<Record<string, unknown>>).map((item) => ({
        id: item.id,
        type: item.object_type,
        name: item.name,
        x: item.x_position,
        y: item.y_position,
        width: item.width,
        height: item.height,
      })),
    },
    200,
    PUBLIC_NO_STORE,
  );
}
