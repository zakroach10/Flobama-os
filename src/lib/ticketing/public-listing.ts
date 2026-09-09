import { createAnonSupabaseClient } from "@/lib/supabase/anon";
import {
  DEMO_DECOR,
  DEMO_TICKET_EVENT,
  DEMO_TICKET_TYPES,
  isDemoTicketingEvent,
  type PublicTable,
  type PublicTicketEvent,
  type PublicTicketType,
} from "@/lib/ticketing/demo";
import { listDemoTables } from "@/lib/ticketing/memory-store";
import { isMissingTicketingSchema } from "@/lib/ticketing/errors";

export type PublicTicketListing = {
  event: PublicTicketEvent | null;
  types: PublicTicketType[];
  tables: PublicTable[];
  decor: typeof DEMO_DECOR;
  demo: boolean;
  error: string | null;
};

export async function getPublicTicketListing(id: string): Promise<PublicTicketListing> {
  if (isDemoTicketingEvent(id)) {
    return {
      event: DEMO_TICKET_EVENT,
      types: DEMO_TICKET_TYPES,
      tables: listDemoTables(),
      decor: DEMO_DECOR,
      demo: true,
      error: null,
    };
  }

  const client = createAnonSupabaseClient();
  if (!client) {
    return { event: null, types: [], tables: [], decor: DEMO_DECOR, demo: false, error: "Ticketing is not configured." };
  }

  const { data: event, error } = await client.from("ticket_event_listings" as never).select("*").eq("id", id).maybeSingle();
  if (error) {
    if (isMissingTicketingSchema(error.message)) {
      return {
        event: null,
        types: [],
        tables: [],
        decor: DEMO_DECOR,
        demo: false,
        error: "Ticketing schema is not applied yet.",
      };
    }
    return { event: null, types: [], tables: [], decor: DEMO_DECOR, demo: false, error: error.message };
  }
  if (!event) {
    return { event: null, types: [], tables: [], decor: DEMO_DECOR, demo: false, error: "Event not found." };
  }

  const row = event as Record<string, unknown>;
  const [{ data: types }, { data: tables }, { data: layout }, { data: decor }] = await Promise.all([
    client.from("ticket_type_listings" as never).select("*").eq("event_id", id).order("sort_order"),
    client.from("event_table_listings" as never).select("*").eq("event_id", id),
    client.from("event_layout_public" as never).select("*").eq("event_id", id).maybeSingle(),
    client.from("event_layout_objects_public" as never).select("*").eq("event_id", id),
  ]);

  return {
    event: {
      id: String(row.id),
      title: String(row.title),
      artists: [],
      description: row.public_description ? String(row.public_description) : null,
      startsAt: String(row.starts_at),
      endsAt: String(row.ends_at),
      doorsAt: row.doors_at ? String(row.doors_at) : null,
      locationLabel: row.location_label ? String(row.location_label) : null,
      tablesEnabled: Boolean(row.tables_enabled),
      refundPolicy: row.refund_policy ? String(row.refund_policy) : null,
      ageRestriction: row.age_restriction ? String(row.age_restriction) : null,
      parkingNotes: row.parking_notes ? String(row.parking_notes) : null,
      venueNotes: row.venue_notes ? String(row.venue_notes) : null,
      holdMinutes: Number(row.hold_minutes ?? 10),
      maxTicketsPerOrder: Number(row.max_tickets_per_order ?? 8),
      canvasWidth: (layout as { canvas_width?: number } | null)?.canvas_width ?? 1200,
      canvasHeight: (layout as { canvas_height?: number } | null)?.canvas_height ?? 860,
    },
    types: ((types ?? []) as Array<Record<string, unknown>>).map((item) => ({
      id: String(item.id),
      eventId: String(item.event_id),
      name: String(item.name),
      description: item.description ? String(item.description) : null,
      kind: item.kind as PublicTicketType["kind"],
      priceCents: Number(item.price_cents),
      maxPerOrder: Number(item.max_per_order),
      remaining: Number(item.remaining),
      sortOrder: Number(item.sort_order),
    })),
    tables: ((tables ?? []) as Array<Record<string, unknown>>).map((item) => ({
      id: String(item.id),
      eventId: String(item.event_id),
      name: String(item.name),
      tableNumber: item.table_number ? String(item.table_number) : null,
      section: item.section ? String(item.section) : null,
      capacity: Number(item.capacity),
      priceCents: Number(item.price_cents ?? 0),
      vip: Boolean(item.vip),
      x: Number(item.x_position),
      y: Number(item.y_position),
      width: Number(item.width),
      height: Number(item.height),
      rotation: Number(item.rotation ?? 0),
      shape: (item.shape as PublicTable["shape"]) ?? "round",
      objectType: String(item.object_type),
      status: item.status as PublicTable["status"],
    })),
    decor: ((decor ?? []) as Array<Record<string, unknown>>).map((item) => ({
      id: String(item.id),
      type: String(item.object_type),
      name: String(item.name),
      x: Number(item.x_position),
      y: Number(item.y_position),
      width: Number(item.width),
      height: Number(item.height),
    })),
    demo: false,
    error: null,
  };
}
