"use server";

import { getStaffContext } from "@/lib/auth/staff";
import { isDemoTicketingEvent } from "@/lib/ticketing/demo";
import { searchDemoOrders } from "@/lib/ticketing/memory-store";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { searchEventTickets } from "@/lib/queries/ticketing";

export type DoorTicketHit = {
  id: string;
  purchaser: string;
  orderNumber: string;
  email: string;
  phone: string;
  tableName: string | null;
  ticketType: string;
  admissionsTotal: number;
  admissionsCheckedIn: number;
  status: string;
};

export async function searchDoorTicketsAction(
  eventId: string,
  query: string,
): Promise<{ ok: true; tickets: DoorTicketHit[] } | { ok: false; message: string }> {
  const context = await getStaffContext();
  if (context.status !== "ok") return { ok: false, message: "Sign in required." };

  if (isDemoTicketingEvent(eventId)) {
    return {
      ok: true,
      tickets: searchDemoOrders(query).map((order) => ({
        id: order.qrTokens[0] ?? order.id,
        purchaser: `${order.firstName} ${order.lastName}`,
        orderNumber: order.orderNumber,
        email: order.email,
        phone: order.phone ?? "",
        tableName: order.tableLabel,
        ticketType: order.tableLabel ? "Table reservation" : order.tickets[0]?.name ?? "Ticket",
        admissionsTotal: order.admissionsTotal,
        admissionsCheckedIn: order.admissionsCheckedIn,
        status: order.admissionsCheckedIn >= order.admissionsTotal ? "checked_in" : "valid",
      })),
    };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) return { ok: false, message: "Supabase is not configured." };
  const { tickets, error } = await searchEventTickets(supabase, eventId, query);
  if (error) return { ok: false, message: error };

  return {
    ok: true,
    tickets: (tickets as Array<Record<string, unknown>>).map((ticket) => {
      const order = ticket.ticketing_orders as
        | { order_number?: string; first_name?: string; last_name?: string; email?: string; phone?: string }
        | { order_number?: string; first_name?: string; last_name?: string; email?: string; phone?: string }[]
        | null;
      const record = Array.isArray(order) ? order[0] : order;
      const table = ticket.event_layout_objects as { name?: string; table_number?: string } | { name?: string; table_number?: string }[] | null;
      const tableRecord = Array.isArray(table) ? table[0] : table;
      return {
        id: String(ticket.qr_token ?? ticket.id),
        purchaser: record ? `${record.first_name ?? ""} ${record.last_name ?? ""}`.trim() : String(ticket.purchaser_name ?? ""),
        orderNumber: record?.order_number ?? "",
        email: record?.email ?? "",
        phone: record?.phone ?? "",
        tableName: tableRecord?.name ?? (tableRecord?.table_number ? `Table ${tableRecord.table_number}` : null),
        ticketType: String(ticket.ticket_type_id ? "Admission" : tableRecord?.name ?? "Ticket"),
        admissionsTotal: Number(ticket.admissions_total ?? 1),
        admissionsCheckedIn: Number(ticket.admissions_checked_in ?? 0),
        status: String(ticket.status ?? "valid"),
      };
    }),
  };
}
