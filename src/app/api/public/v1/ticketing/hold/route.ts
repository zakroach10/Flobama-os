import { z } from "zod";
import { publicOptions } from "@/lib/public/http";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { DEMO_TICKET_EVENT_ID, DEMO_TICKET_TYPES } from "@/lib/ticketing/demo";
import { holdDemoTable, holdDemoTickets } from "@/lib/ticketing/memory-store";
import { getOrCreateTicketSession, publicTicketingJson } from "@/lib/ticketing/http";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return publicOptions();
}

const schema = z.object({
  eventId: z.string().min(1),
  tableId: z.string().min(1).optional(),
  ticketTypeId: z.string().optional(),
  quantity: z.number().int().min(1).max(50).optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return publicTicketingJson({ ok: false, error: "Invalid hold request." }, 400);
  const session = await getOrCreateTicketSession();
  const { eventId, tableId, ticketTypeId, quantity } = parsed.data;

  if (eventId === DEMO_TICKET_EVENT_ID || eventId === "demo") {
    if (tableId) {
      const result = holdDemoTable(tableId.startsWith("demo-") ? tableId : `demo-table-${tableId}`, session);
      if (!result.ok) {
        const fallback = holdDemoTable(tableId, session);
        return publicTicketingJson(fallback.ok ? { ...fallback, session } : fallback, fallback.ok ? 200 : 409);
      }
      return publicTicketingJson({ ...result, session });
    }
    if (ticketTypeId) {
      const type = DEMO_TICKET_TYPES.find((item) => item.id === ticketTypeId);
      if (!type) return publicTicketingJson({ ok: false, error: "Ticket type not found." }, 404);
      const result = holdDemoTickets(ticketTypeId, quantity ?? 1, session);
      return publicTicketingJson({ ...result, session });
    }
    return publicTicketingJson({ ok: false, error: "Nothing to hold." }, 400);
  }

  const admin = createServiceRoleClient();
  if (!admin) return publicTicketingJson({ ok: false, error: "Ticketing is not configured." }, 503);

  if (tableId) {
    const { data, error } = await admin.rpc("hold_event_table" as never, {
      p_object_id: tableId,
      p_session: session,
      p_minutes: 10,
    } as never);
    if (error) return publicTicketingJson({ ok: false, error: error.message }, 500);
    const result = data as { ok?: boolean; error?: string; holdUntil?: string };
    return publicTicketingJson({ ...result, session }, result?.ok ? 200 : 409);
  }

  if (ticketTypeId) {
    const { data, error } = await admin.rpc("hold_ticket_type" as never, {
      p_type_id: ticketTypeId,
      p_quantity: quantity ?? 1,
      p_session: session,
      p_minutes: 10,
    } as never);
    if (error) return publicTicketingJson({ ok: false, error: error.message }, 500);
    const result = data as { ok?: boolean; error?: string };
    return publicTicketingJson({ ...result, session }, result?.ok ? 200 : 409);
  }

  return publicTicketingJson({ ok: false, error: "Nothing to hold." }, 400);
}
