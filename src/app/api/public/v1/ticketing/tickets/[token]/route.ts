import { publicOptions } from "@/lib/public/http";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getDemoOrderByQr } from "@/lib/ticketing/memory-store";
import { publicTicketingJson } from "@/lib/ticketing/http";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return publicOptions();
}

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const demo = getDemoOrderByQr(token);
  if (demo) {
    return publicTicketingJson({
      ok: true,
      ticket: {
        purchaser: `${demo.firstName} ${demo.lastName}`,
        orderNumber: demo.orderNumber,
        admissionsTotal: demo.admissionsTotal,
        admissionsCheckedIn: demo.admissionsCheckedIn,
        status: demo.admissionsCheckedIn >= demo.admissionsTotal ? "checked_in" : "valid",
        eventName: "FloBama live",
        tableLabel: demo.tableLabel,
        ticketType: demo.tableLabel ? "Table reservation" : demo.tickets[0]?.name ?? "Ticket",
      },
    });
  }

  const admin = createServiceRoleClient();
  if (!admin) return publicTicketingJson({ ok: false, error: "Not configured." }, 503);
  const { data, error } = await admin
    .from("tickets" as never)
    .select("*, ticketing_orders(order_number, first_name, last_name), events(title), event_layout_objects(name, table_number), ticket_types(name)")
    .eq("qr_token", token)
    .maybeSingle();
  if (error) return publicTicketingJson({ ok: false, error: error.message }, 500);
  if (!data) return publicTicketingJson({ ok: false, error: "Ticket not found." }, 404);
  const row = data as {
    purchaser_name: string;
    admissions_total: number;
    admissions_checked_in: number;
    status: string;
    ticketing_orders?: { order_number: string };
    events?: { title: string };
    event_layout_objects?: { name?: string; table_number?: string } | { name?: string; table_number?: string }[];
    ticket_types?: { name?: string } | { name?: string }[];
  };
  const table = Array.isArray(row.event_layout_objects) ? row.event_layout_objects[0] : row.event_layout_objects;
  const type = Array.isArray(row.ticket_types) ? row.ticket_types[0] : row.ticket_types;
  return publicTicketingJson({
    ok: true,
    ticket: {
      purchaser: row.purchaser_name,
      orderNumber: row.ticketing_orders?.order_number,
      admissionsTotal: row.admissions_total,
      admissionsCheckedIn: row.admissions_checked_in,
      status: row.status,
      eventName: row.events?.title,
      tableLabel: table?.name ?? (table?.table_number ? `Table ${table.table_number}` : null),
      ticketType: type?.name ?? (table?.name ?? "Ticket"),
    },
  });
}
